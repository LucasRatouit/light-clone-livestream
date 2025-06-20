import { Router } from "express";
import prisma from "./db/prisma";
import { Auth } from "./auth";
import { IngressClient } from "livekit-server-sdk";

const router = Router();

router.get("/userById/:id", async (req, res) => {
  const { id } = req.params;
  const user = await prisma.user.findUnique({
    where: {
      id: id,
    },
    select: {
      id: true,
      username: true,
    },
  });

  if (!user) {
    res
      .status(404)
      .json({ success: false, message: "utilisateur introuvable" });
    return;
  }

  res.status(200).json({ success: true, message: user });
});

router.get("/asFollowing/:id", Auth, async (req, res) => {
  const user = req.user;
  const { id } = req.params;

  const follow = await prisma.follow.findFirst({
    where: {
      user_id: user?.id,
      target_id: id,
    },
  });

  if (follow) {
    res.status(200).json({ success: true, message: true });
  } else {
    res.status(200).json({ success: true, message: false });
  }
});

router.get("/following", Auth, async (req, res) => {
  const user = req.user;

  const response = await prisma.follow.findMany({
    where: {
      user_id: user?.id,
    },
    include: {
      target: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  // Ajouter l'info live
  const ingressClient = new IngressClient(process.env.LIVEKIT_URL!);
  const ingressList = await ingressClient.listIngress();

  const userList = response.map((follow) => {
    let liveStatus = "Hors ligne";

    const ingress = ingressList.find(
      (ingress) => ingress.roomName === follow.target.id
    );
    if (ingress?.state?.status === 2) {
      liveStatus = "Live";
    }

    return {
      id: follow.target.id,
      username: follow.target.username,
      liveStatus: liveStatus,
    };
  });

  res.status(200).json({ success: true, message: userList });
});

router.post("/followUser/:id", Auth, async (req, res) => {
  const user = req.user;
  const { id } = req.params;

  if (!user) {
    res
      .status(404)
      .json({ success: false, message: "utilisateur introuvable" });
    return;
  }

  await prisma.follow.create({
    data: {
      user_id: user.id,
      target_id: id,
    },
  });

  res.status(200).json({ success: true, message: "Abonnement réussi" });
});
``;

router.delete("/unfollowUser/:id", Auth, async (req, res) => {
  const user = req.user;
  const { id } = req.params;

  if (!user) {
    res
      .status(404)
      .json({ success: false, message: "utilisateur introuvable" });
    return;
  }

  await prisma.follow.delete({
    where: {
      user_id_target_id: {
        user_id: user.id,
        target_id: id,
      },
    },
  });

  res.status(200).json({ success: true, message: "Désabonnement réussi" });
});

router.get("/getUserByUsername/:username", async (req, res) => {
  const { username } = req.params;

  const user = await prisma.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      username: true,
    },
  });

  if (!user) {
    res
      .status(404)
      .json({ success: false, message: "utilisateur introuvable" });
    return;
  }

  res.status(200).json({ success: true, message: user });
});

export default router;
