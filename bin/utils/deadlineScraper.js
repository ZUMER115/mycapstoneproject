const axios = require('axios');
const cheerio = require('cheerio');
const dayjs = require('dayjs');

const calendarUrls = [
  'https://www.uwb.edu/academic-calendar/2024-2025-calendars/application-deadlines-2024-2025',
  'https://www.uwb.edu/academic-calendar/2024-2025-calendars/dates-of-instruction-2024-2025',
  'https://www.uwb.edu/academic-calendar/2024-2025-calendars/grade-deadlines-2024-2025',
  'https://www.uwb.edu/academic-calendar/2024-2025-calendars/registration-deadlines-2024-2025',
  'https://www.uwb.edu/academic-calendar/2024-2025-calendars/tuition-fee-assessment-deadlines-2024-2025',
  'https://www.uwb.edu/academic-calendar/2024-2025-calendars/u-pass-activation-dates-payment-due-dates-2024-2025'
];

function parseDate(dateStr) {
  const monthMap = {
    Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April',
    Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September',
    Oct: 'October', Nov: 'November', Dec: 'December'
  };
  const normalized = dateStr.replace(/\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b\.?/g, match =>
    monthMap[match.replace('.', '')]
  );
  return dayjs(normalized);
}

function categorize(eventText, headingText) {
  const combined = `${eventText} ${headingText}`.toLowerCase();

  if (/(registration|register|enroll)/.test(combined)) return 'registration';
  if (/(add|drop|withdrawal|change.*course)/.test(combined)) return 'add/drop';
  if (/(financial aid|payment|tuition|fee|u-pass)/.test(combined)) return 'financial-aid';

  return 'other';
}


async function fetchAllDeadlines() {
  const deadlines = [];

  for (const url of calendarUrls) {
    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);

      $('table').each((tableIndex, table) => {
        // Find the nearest previous heading to label the table
        let tableHeading = '';
        const prev = $(table).prevAll('h1, h2, h3, h4, p').first();
        if (prev.length) tableHeading = prev.text().trim();

        let lastEvent = '';

        $(table).find('tbody tr').each((_, row) => {
          const th = $(row).find('th').first();

          if (th.length > 0) {
            lastEvent = th
              .contents()
              .filter(function () {
                return this.type === 'text' || this.name === 'a';
              })
              .map((_, el) => $(el).text())
              .get()
              .join(' ')
              .trim();
          }

          const cells = $(row).find('td');
          cells.each((_, cell) => {
            const rawDate = $(cell).text().trim();
            const parsedDate = parseDate(rawDate);
            if (parsedDate && parsedDate.isValid()) {
              const category = categorize(lastEvent, tableHeading);
              deadlines.push({
                event: lastEvent,
                date: rawDate,
                dateObj: parsedDate,
                category
              });
            }
          });
        });
      });
    } catch (error) {
      console.error(`Error scraping ${url}:`, error.message);
    }
  }

  deadlines.sort((a, b) => a.dateObj - b.dateObj);
  return deadlines.map(({ event, date, category }) => ({ event, date, category }));
}

module.exports = { fetchAllDeadlines };
