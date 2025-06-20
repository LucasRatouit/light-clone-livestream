import { NextFunction, Request, Response, Router } from "express";
import prisma from "./db/prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = Router();

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        username: string;
      };
    }
  }
}

export const Auth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.tokenJwt;
  if (!token) {
    res
      .status(401)
      .json({ success: false, message: "Utilisateur non connecté" });
    return;
  }
  jwt.verify(token, process.env.JWT_SECRET!, (err: any, decoded: any) => {
    if (err) {
      res.status(401).json({ success: false, message: "Token invalide" });
      return;
    }
    req.user = decoded;
    next();
  });
};

router.get("/verify", async (req, res) => {
  try {
    const token = req.cookies.tokenJwt;

    if (!token) {
      return;
    }

    jwt.verify(token, process.env.JWT_SECRET!, (err: any, decoded: any) => {
      if (err) {
        res.clearCookie("tokenJwt", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
        });
        res.status(401).json({ success: false, message: "Token invalide" });
        return;
      }

      res.status(200).json({ success: true, message: "Token valide" });
    });
  } catch (err) {
    console.error(err);
  }
});

router.get("/username", async (req, res) => {
  try {
    const cookie = req.cookies.tokenJwt;

    if (!cookie) {
      res.status(401).json({ success: false, message: "Token introuvable" });
      return;
    }

    jwt.verify(
      cookie,
      process.env.JWT_SECRET!,
      async (err: any, decoded: any) => {
        if (err) {
          res.status(401).json({ success: false, message: "Token invalide" });
          return;
        }

        res.status(200).json({
          success: true,
          message: decoded.username,
        });
      }
    );
  } catch (err) {
    console.error(err);
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res
        .status(400)
        .json({ success: false, message: "Email ou mot de passe manquant" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      res
        .status(404)
        .json({ success: false, message: "Utilisateur introuvable" });
      return;
    }

    bcrypt.compare(password, user.password, function (err, result) {
      if (err) {
        console.log(err);
        res.status(500).json({
          success: false,
          message: "Erreur serveur : Compare password",
        });
      }

      if (!result) {
        res
          .status(401)
          .json({ success: false, message: "Mot de passe incorrect" });
        return;
      } else {
        const token = jwt.sign(
          {
            id: user.id,
            email: user.email,
            username: user.username,
          },
          process.env.JWT_SECRET || "",
          {
            expiresIn: "1h",
          }
        );
        res.cookie("tokenJwt", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 3600000, // 1 hour
        });

        res.status(200).json({ success: true, message: "Connexion réussie !" });
      }
    });
  } catch (err) {
    console.error(err);
  }
});

router.post("/register", async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password) {
      res
        .status(400)
        .json({ success: false, message: "Email ou mot de passe manquant" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (user) {
      res.status(400).json({ success: false, message: "Email déjà utilisé" });
      return;
    }

    const userName = await prisma.user.findUnique({
      where: {
        username,
      },
    });

    if (userName) {
      res
        .status(400)
        .json({ success: false, message: "Nom d'utilisateur déjà utilisé" });
      return;
    }

    bcrypt.hash(password, 10, async function (err, hash) {
      if (err) {
        console.log(err);
        res
          .status(500)
          .json({ success: false, message: "Erreur serveur : Hash password" });
      }

      const user = await prisma.user.create({
        data: {
          email,
          password: hash,
          username,
        },
      });

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          username: user.username,
        },
        process.env.JWT_SECRET || "",
        {
          expiresIn: "1h",
        }
      );
      res.cookie("tokenJwt", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 3600000, // 1 hour
      });

      res
        .status(201)
        .json({ success: true, message: "Compte créé avec succès !" });
    });
  } catch (err) {
    console.error(err);
  }
});

router.post("/logout", async (req, res) => {
  try {
    res.clearCookie("tokenJwt", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    res.status(200).json({ success: true, message: "Déconnexion réussie !" });
  } catch (err) {
    console.error(err);
  }
});

export default router;
