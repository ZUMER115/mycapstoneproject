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

async function fetchAllDeadlines() {
  const deadlines = [];

  for (const url of calendarUrls) {
    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);

      $('table').each((_, table) => {
        $(table).find('tbody tr').each((_, row) => {
          const th = $(row).find('th').first();
          const event = th
            .contents()
            .filter(function () {
              return this.type === 'text' || this.name === 'a';
            })
            .map((_, el) => $(el).text())
            .get()
            .join(' ')
            .trim();

          const cells = $(row).find('td');
          cells.each((_, cell) => {
            const rawDate = $(cell).text().trim();
            const parsedDate = parseDate(rawDate);
            if (parsedDate && parsedDate.isValid()) {
              deadlines.push({
                event,
                date: rawDate,
                dateObj: parsedDate
              });
            }
          });
        });
      });
    } catch (error) {
      console.error(`Error scraping ${url}:`, error.message);
    }
  }

  // Sort fully by parsed date object
  deadlines.sort((a, b) => a.dateObj - b.dateObj);

  return deadlines.map(({ event, date }) => ({ event, date }));
}

function parseDate(dateStr) {
  // Normalize abbreviated months to full names where needed
  const monthMap = {
    Jan: 'January',
    Feb: 'February',
    Mar: 'March',
    Apr: 'April',
    Jun: 'June',
    Jul: 'July',
    Aug: 'August',
    Sep: 'September',
    Oct: 'October',
    Nov: 'November',
    Dec: 'December'
  };

  const normalized = dateStr.replace(/\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b\.?/g, match => monthMap[match.replace('.', '')]);

  return dayjs(normalized);
}

module.exports = { fetchAllDeadlines };
