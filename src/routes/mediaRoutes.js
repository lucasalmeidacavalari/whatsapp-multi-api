import express from "express";
import multer from "multer";
import { sendMedia } from "../services/mediaService.js";
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
      const result = await sendMedia({
        sessionName,
        to,
        caption,
        buffer: req.file.buffer,
        originalName: req.file.originalname,
      });

      return res.json(result);
    } catch (err) {
      console.error("Erro ao enviar mídia:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

export default router;
