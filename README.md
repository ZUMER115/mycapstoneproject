Sparely 

Overview
Sparely is a full-stack academic deadline platform designed to help university students track important academic dates, manage personalized deadlines, and plan graduation requirements.
The system integrates user authentication, automated deadline scraping, PostgreSQL data persistence, and containerized deployment to provide a production-style web application experience.

Tech Stack
a) Frontend
    - React
b) Backend
    - Node.js
    - Express
c) Database
    - PostgreSQL
d) Infrastructure
    - Docker/Docker Compose
    - Web scraping w/Cheerio
    - Authentication (JWT)


Architecture

Client (React)
↓
Express API (Node.js)
↓
PostgreSQL

Deadline scraping service
↓
Database persistence
↓
User dashboard rendering


Core Features
- Secure user registration and login (JWT authentication)
- Personalized academic dashboard
- Automated scraping of university academic calendars
- Deadline normalization and database storage
- Graduation planning logic based on remaining requirements
- Email notification support 
