const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "erp-tricks-sac-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

async function hashPassword(password) {
  return bcrypt.hash(String(password), 10);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(String(password), hash);
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
};
