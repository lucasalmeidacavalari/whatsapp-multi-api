import express from "express";
import { getGroups } from "../services/groupService.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/groups/:sessionName", authMiddleware, async (req, res) => {
  const { sessionName } = req.params;

  try {
    const groups = await getGroups(sessionName);
    return res.json(groups);
  } catch (err) {
    console.error("Erro ao buscar grupos:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
