import express from 'express';
import { logoutSession } from '../services/logoutService.js';

const router = express.Router();

router.delete('/logout/:sessionName', async (req, res) => {
  const { sessionName } = req.params;

  try {
    const result = await logoutSession(sessionName);
    return res.json(result);
  } catch (err) {
    console.error('Erro ao desconectar sessão:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
