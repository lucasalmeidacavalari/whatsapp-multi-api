// src/middleware/authMiddleware.js
import dotenv from "dotenv";
dotenv.config();

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  const token = authHeader.split(" ")[1];

  if (token !== process.env.BEARER_TOKEN) {
    return res.status(403).json({ error: "Token inválido" });
  }

  next();
}
