import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  RequestPropertyImageUploadBody,
  RequestPropertyImageUploadResponse,
  RequestProductImageUploadBody,
  RequestProductImageUploadResponse,
} from "@workspace/api-zod";
import express, {
  Router,
  type IRouter,
  type Request,
  type Response,
} from "express";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const TOKEN_LIFETIME_SECONDS = 10 * 60;
const contentTypes = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;
type ImageContentType = (typeof contentTypes)[keyof typeof contentTypes];
type UploadPurpose = "products" | "properties";
type UploadClaims = {
  filename: string;
  contentType: ImageContentType;
  size: number;
  expiresAt: number;
};
const purposeLabel = (purpose: UploadPurpose) =>
  purpose === "products" ? "product" : "property";

function getSigningKey(): string {
  const key = process.env.MEDIA_UPLOAD_SIGNING_KEY;
  if (!key || Buffer.byteLength(key) < 32) {
    throw new Error("MEDIA_UPLOAD_SIGNING_KEY must contain at least 32 bytes.");
  }
  return key;
}

function signClaims(claims: UploadClaims): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", getSigningKey())
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function verifyClaims(
  token: string,
  filename: string,
  purpose: UploadPurpose,
): UploadClaims | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = createHmac("sha256", getSigningKey())
    .update(payload)
    .digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return null;

  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as UploadClaims;
    if (
      claims.filename !== filename ||
      !new RegExp(`^crits-${purpose}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(
        claims.filename,
      ) ||
      !Object.values(contentTypes).includes(claims.contentType) ||
      !Number.isInteger(claims.size) ||
      claims.size < 1 ||
      claims.size > MAX_IMAGE_SIZE ||
      !Number.isInteger(claims.expiresAt) ||
      claims.expiresAt < Math.floor(Date.now() / 1000)
    )
      return null;
    return claims;
  } catch {
    return null;
  }
}

function hasValidImageSignature(
  bytes: Buffer,
  contentType: ImageContentType,
): boolean {
  if (contentType === "image/jpeg")
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  if (contentType === "image/png")
    return bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  );
}

function getMediaDirectory(purpose: UploadPurpose): string {
  const configured = process.env.MEDIA_DIR;
  return configured
    ? path.resolve(import.meta.dirname, "../../../", configured)
    : path.resolve(
        import.meta.dirname,
        "../../../var",
        purpose === "products" ? "product-images" : "property-images",
      );
}

function createImageUploadRequest(purpose: UploadPurpose) {
  return (req: Request, res: Response): void => {
    const parsed = (
      purpose === "products"
        ? RequestProductImageUploadBody
        : RequestPropertyImageUploadBody
    ).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid image details." });
      return;
    }

    try {
      const { contentType, size } = parsed.data;
      const extension =
        contentType === "image/jpeg"
          ? "jpg"
          : contentType === "image/png"
            ? "png"
            : "webp";
      const filename = `${randomUUID()}.${extension}`;
      const relativePath = `crits-${purpose}/${filename}`;
      const claims: UploadClaims = {
        filename: relativePath,
        contentType,
        size,
        expiresAt: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS,
      };
      const origin = req.get("origin");
      if (!origin) {
        res
          .status(400)
          .json({ error: "A same-origin browser request is required." });
        return;
      }
      const route = purpose === "products" ? "uploads" : "property-uploads";
      const uploadURL = new URL(
        `/api/storage/${route}/${encodeURIComponent(filename)}`,
        origin,
      );
      uploadURL.searchParams.set("token", signClaims(claims));
      const imageUrl = `/api/storage/public-objects/${relativePath}`;
      const response = { uploadURL: uploadURL.toString(), imageUrl };
      res.json(
        (purpose === "products"
          ? RequestProductImageUploadResponse
          : RequestPropertyImageUploadResponse
        ).parse(response),
      );
    } catch (error) {
      req.log.error(
        { err: error },
        `Could not create a ${purposeLabel(purpose)} image upload token`,
      );
      res.status(503).json({ error: "Image storage is not configured." });
    }
  };
}

router.post(
  "/storage/uploads/request-url",
  requireAdmin,
  createImageUploadRequest("products"),
);
router.post(
  "/storage/property-uploads/request-url",
  requireAdmin,
  createImageUploadRequest("properties"),
);

function createImageUploadHandler(purpose: UploadPurpose) {
  return [
    express.raw({
      type: ["image/jpeg", "image/png", "image/webp"],
      limit: MAX_IMAGE_SIZE,
    }),
    async (req: Request, res: Response): Promise<void> => {
      const uploadName = Array.isArray(req.params.filename)
        ? (req.params.filename[0] ?? "")
        : req.params.filename;
      if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(uploadName)) {
        res.status(400).json({ error: "Invalid image name." });
        return;
      }
      const filename = `crits-${purpose}/${uploadName}`;
      let claims: UploadClaims | null;
      try {
        claims = verifyClaims(String(req.query.token ?? ""), filename, purpose);
      } catch {
        res.status(503).json({ error: "Image storage is not configured." });
        return;
      }
      if (!claims) {
        res
          .status(403)
          .json({ error: "Upload authorization is invalid or expired." });
        return;
      }
      const bytes = req.body;
      if (
        !Buffer.isBuffer(bytes) ||
        bytes.length !== claims.size ||
        bytes.length > MAX_IMAGE_SIZE
      ) {
        res
          .status(400)
          .json({
            error: "Uploaded image size does not match its signed request.",
          });
        return;
      }
      if (
        req.get("content-type")?.split(";")[0]?.trim() !== claims.contentType ||
        !hasValidImageSignature(bytes, claims.contentType)
      ) {
        res
          .status(415)
          .json({
            error:
              "Uploaded content is not a valid image of the declared type.",
          });
        return;
      }

      try {
        const targetDirectory = path.join(
          getMediaDirectory(purpose),
          `crits-${purpose}`,
        );
        await mkdir(targetDirectory, { recursive: true });
        const target = path.join(targetDirectory, uploadName);
        await writeFile(target, bytes, { flag: "wx", mode: 0o640 });
        res.status(201).json({ uploaded: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") {
          res
            .status(409)
            .json({ error: "This upload URL has already been used." });
          return;
        }
        req.log.error(
          { err: error },
          `Could not save ${purposeLabel(purpose)} image`,
        );
        res.status(500).json({ error: "Could not save image." });
      }
    },
  ] as const;
}

router.put(
  "/storage/uploads/:filename",
  ...createImageUploadHandler("products"),
);
router.put(
  "/storage/property-uploads/:filename",
  ...createImageUploadHandler("properties"),
);

router.get(
  "/storage/public-objects/*path",
  async (req: Request, res: Response) => {
    const rawPath = req.params.path;
    const relativePath = Array.isArray(rawPath) ? rawPath.join("/") : rawPath;
    const purpose = relativePath.startsWith("crits-properties/")
      ? "properties"
      : relativePath.startsWith("crits-products/")
        ? "products"
        : null;
    if (
      !purpose ||
      !new RegExp(`^crits-${purpose}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(
        relativePath,
      )
    ) {
      res.status(404).json({ error: "Image not found." });
      return;
    }
    const extension = relativePath.slice(
      relativePath.lastIndexOf(".") + 1,
    ) as keyof typeof contentTypes;
    try {
      const image = await readFile(
        path.join(getMediaDirectory(purpose), relativePath),
      );
      res.set({
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
      });
      res.type(contentTypes[extension]).send(image);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        res.status(404).json({ error: "Image not found." });
        return;
      }
      req.log.error({ err: error }, "Could not serve image");
      res.status(500).json({ error: "Could not serve image." });
    }
  },
);

export default router;
