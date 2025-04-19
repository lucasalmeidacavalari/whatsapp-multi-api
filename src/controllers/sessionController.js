import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

router.get('/session-status/:cpfcnpj', async (req, res) => {
  const { cpfcnpj } = req.params;

  try {
    const empresa = await prisma.tempresa.findUnique({
      where: { cpfcnpj },
      include: {
        sessions: {
          select: {
            sessionName: true,
            numero: true,
            isConnected: true,
            createdAt: true
          }
        }
      }
    });

    if (!empresa) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    return res.json({
      empresa: empresa.nome,
      cpfcnpj: empresa.cpfcnpj,
      sessoes: empresa.sessions
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar sessões' });
  }
});
