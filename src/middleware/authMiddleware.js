// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function authMiddleware(req, res, next) {
  // Expecting: Authorization: Bearer <token>
  const authHeader = req.headers['authorization'] || req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Attach user info to the request
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (err) {
    console.error('[authMiddleware] JWT error:', err.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;
