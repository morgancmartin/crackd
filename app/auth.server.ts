import { Authenticator } from "remix-auth";
import { GoogleStrategy } from "@coji/remix-auth-google";
import { sessionStorage } from "./session.server";
import { access } from "fs";
import type { User } from "@prisma/client";
import { prisma } from "~/db.server";

const googleStrategy = new GoogleStrategy(
  {
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    redirectURI: "http://localhost:3000/auth/google/callback",
  },
  async (data) => {
    console.log("GOT DATA:", data);
    const profile = await GoogleStrategy.userProfile(data.tokens);
    console.log("profile", profile);
    const existingUser = await prisma.user.findUnique({
      where: {
        email: profile.emails[0].value,
      },
    });

    if (existingUser) {
      return existingUser;
    } else {
      const newUser = await prisma.user.create({
        data: {
          email: profile.emails[0].value,
          givenName: profile.name.givenName,
          familyName: profile.name.familyName,
          picture: profile.photos[0].value,
        },
      });
      return newUser;
    }
  },
);

export const authenticator = new Authenticator<User>();
authenticator.use(googleStrategy as any);
