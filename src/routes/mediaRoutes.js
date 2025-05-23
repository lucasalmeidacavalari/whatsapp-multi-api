import express from "express";
import multer from "multer";
import { sendMediaHandler } from "../services/mediaService.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/send-media",
  upload.single("file"),
  authMiddleware,
  async (req, res) => {
    const { sessionName, to, caption } = req.body;

    if (!sessionName || !to || !req.file) {
      return res
        .status(400)
        .json({ error: "sessionName, to e file são obrigatórios" });
    }

    try {
      const result = await sendMediaHandler({
        sessionName,
        to,
        caption,
        buffer: req.file.buffer,
        originalName: req.file.originalname,
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.json(result);
    } catch (err) {
      console.error("Erro ao enviar mídia:", err);
      return res.status(500).json({ error: "Erro interno ao enviar mídia" });
    }
  }
);

export default router;
