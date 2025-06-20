import { Router } from "express";
import {
  AccessToken,
  IngressClient,
  IngressInput,
  RoomServiceClient,
  VideoGrant,
} from "livekit-server-sdk";
import prisma from "./db/prisma";
import { Auth } from "./auth";

const router = Router();

const ingressClient = new IngressClient(process.env.LIVEKIT_URL!);

// const roomService = new RoomServiceClient(
//   process.env.LIVEKIT_URL!,
//   process.env.LIVEKIT_API_KEY!,
//   process.env.LIVEKIT_API_SECRET!
// );

router.post("/token", async (req, res) => {
  const { roomName } = req.body;
  let identityName = "";

  const userToken = req.cookies.tokenJwt;
  if (!userToken) {
    identityName = new Date().getTime().toString();
  } else {
    const user = await prisma.user.findUnique({
      where: {
        id: userToken.id,
      },
    });

    if (!user) {
      identityName = new Date().getTime().toString();
    } else {
      identityName = user?.id.toString();
    }
  }

  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: identityName,
      ttl: "7 days",
    }
  );

  const videoGrant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: false,
    canSubscribe: true,
  };

  at.addGrant(videoGrant);

  const token = await at.toJwt();

  res.status(200).json({
    success: true,
    message: token,
  });
});

router.get("/userHasKey", Auth, async (req, res) => {
  const user = req.user;

  const userDb = await prisma.user.findUnique({
    where: {
      id: user?.id,
    },
  });

  if (userDb?.ingressId && userDb.serverUrl && userDb.streamKey) {
    res.status(200).json({
      success: true,
      message: {
        ingressId: userDb.ingressId,
        serverUrl: userDb.serverUrl,
        streamKey: userDb.streamKey,
      },
    });
  } else {
    res.status(404).json({
      success: false,
      message: "Aucune clé trouvée",
    });
  }
});

router.post("/create", Auth, async (req, res) => {
  if (!req.user) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  const existingIngress = await ingressClient.listIngress();
  if (existingIngress.length >= 2) {
    existingIngress.forEach(async (ingress) => {
      if (ingress.state?.status !== 2) {
        await ingressClient.deleteIngress(ingress.ingressId);
      }
    });
  }

  const ingressConfig = {
    name: req.user.username,
    roomName: req.user.id,
    participantName: req.user.username,
    participantIdentity: req.user.id,
  };

  const ingress = await ingressClient.createIngress(
    IngressInput.RTMP_INPUT,
    ingressConfig
  );

  // const ingress = await ingressClient.createIngress(
  //   IngressInput.WHIP_INPUT,
  //   ingressConfig
  // );

  await prisma.user.update({
    where: {
      id: req.user.id,
    },
    data: {
      ingressId: ingress.ingressId,
      serverUrl: ingress.url,
      streamKey: ingress.streamKey,
    },
  });

  res.status(200).json({ success: true, message: "Clé créée avec succès" });
});

router.get("/userKey", Auth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: {
      id: req.user?.id,
    },
  });

  if (!user) {
    res
      .status(404)
      .json({ success: false, message: "Aucun utilisateur trouvé" });
    return;
  }

  res.status(200).json({
    success: true,
    message: {
      serverUrl: user.serverUrl,
      streamKey: user.streamKey,
    },
  });
});

router.delete("/delete", Auth, async (req, res) => {
  const ingress = await ingressClient.listIngress({
    roomName: req.user?.id,
  });

  if (ingress.length === 0) {
    res.status(404).json({ success: false, message: "Aucune clé trouvée" });
    return;
  }

  await ingressClient.deleteIngress(ingress[0].ingressId);

  await prisma.user.update({
    where: {
      id: req.user?.id,
    },
    data: {
      ingressId: null,
      serverUrl: null,
      streamKey: null,
    },
  });

  res.status(200).json({
    success: true,
    message: "Clé supprimée avec succès",
  });
});

router.get("/userLive", async (req, res) => {
  const ingresses = await ingressClient.listIngress();

  const ingressesLiveOn = ingresses.filter(
    (ingress) => ingress.state?.status === 2
  );

  const userLiveList = ingressesLiveOn.map((ingress) => ingress.roomName);

  const userLive = await prisma.user.findMany({
    where: {
      id: {
        in: userLiveList,
      },
    },
    select: {
      id: true,
      username: true,
    },
  });

  res.status(200).json({
    success: true,
    message: userLive,
  });
});

export default router;
