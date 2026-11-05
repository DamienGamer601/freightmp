import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();
const user = await prisma.user.findFirst({ where: { role: "ADMIN" } });
if (!user) { console.log("NO_ADMIN"); process.exit(1); }
const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
console.log(token);
await prisma.$disconnect();
