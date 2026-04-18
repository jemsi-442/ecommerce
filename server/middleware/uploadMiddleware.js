import multer from "multer";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import cloudinary from "../config/cloudinary.js";
import ApiError from "../utils/ApiError.js";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const productUploadsDir = path.resolve(__dirname, "../uploads/products");
const deliveryUploadsDir = path.resolve(__dirname, "../uploads/delivery-proofs");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(new ApiError(400, "Invalid file type. Allowed: jpeg, png, webp"));
    return;
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
});

const sanitizeFilename = (name = "product") =>
  String(name)
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(0, 80) || "product";

export const isCloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_NAME &&
      !process.env.CLOUDINARY_NAME.startsWith("replace_with_") &&
      process.env.CLOUDINARY_API_KEY &&
      !process.env.CLOUDINARY_API_KEY.startsWith("replace_with_") &&
      process.env.CLOUDINARY_API_SECRET &&
      !process.env.CLOUDINARY_API_SECRET.startsWith("replace_with_")
  );

export const uploadProductImageToCloudinary = async (fileBuffer, originalname = "product") => {
  if (!fileBuffer) throw new ApiError(400, "No image file provided");

  const uploadResult = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "products",
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        transformation: [
          { width: 1600, height: 1600, crop: "limit" },
          { quality: "auto", fetch_format: "auto" },
        ],
        public_id: `${Date.now()}-${originalname.replace(/\.[^/.]+$/, "")}`,
      },
      (error, result) => {
        if (error) return reject(new ApiError(502, "Cloudinary upload failed", error));
        resolve(result);
      }
    );

    stream.end(fileBuffer);
  });

  return {
    url: uploadResult.secure_url,
    publicId: uploadResult.public_id,
  };
};

export const saveProductImageLocally = async (fileBuffer, originalname = "product") => {
  if (!fileBuffer) throw new ApiError(400, "No image file provided");

  await fs.mkdir(productUploadsDir, { recursive: true });

  const extension = path.extname(originalname || "").toLowerCase() || ".jpg";
  const filename = `${Date.now()}-${sanitizeFilename(originalname)}${extension}`;
  const filepath = path.join(productUploadsDir, filename);

  await fs.writeFile(filepath, fileBuffer);

  return {
    url: `/uploads/products/${filename}`,
    publicId: null,
  };
};

export const uploadProductImage = async (fileBuffer, originalname = "product") => {
  if (isCloudinaryConfigured()) {
    return uploadProductImageToCloudinary(fileBuffer, originalname);
  }

  return saveProductImageLocally(fileBuffer, originalname);
};

export const uploadDeliveryProofImageToCloudinary = async (fileBuffer, originalname = "delivery-proof") => {
  if (!fileBuffer) throw new ApiError(400, "No image file provided");

  const uploadResult = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "delivery-proofs",
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        transformation: [
          { width: 1600, height: 1600, crop: "limit" },
          { quality: "auto", fetch_format: "auto" },
        ],
        public_id: `${Date.now()}-${originalname.replace(/\.[^/.]+$/, "")}`,
      },
      (error, result) => {
        if (error) return reject(new ApiError(502, "Cloudinary upload failed", error));
        resolve(result);
      }
    );

    stream.end(fileBuffer);
  });

  return {
    url: uploadResult.secure_url,
    publicId: uploadResult.public_id,
  };
};

export const saveDeliveryProofImageLocally = async (fileBuffer, originalname = "delivery-proof") => {
  if (!fileBuffer) throw new ApiError(400, "No image file provided");

  await fs.mkdir(deliveryUploadsDir, { recursive: true });

  const extension = path.extname(originalname || "").toLowerCase() || ".jpg";
  const filename = `${Date.now()}-${sanitizeFilename(originalname)}${extension}`;
  const filepath = path.join(deliveryUploadsDir, filename);

  await fs.writeFile(filepath, fileBuffer);

  return {
    url: `/uploads/delivery-proofs/${filename}`,
    publicId: null,
  };
};

export const uploadDeliveryProofImage = async (fileBuffer, originalname = "delivery-proof") => {
  if (isCloudinaryConfigured()) {
    return uploadDeliveryProofImageToCloudinary(fileBuffer, originalname);
  }

  return saveDeliveryProofImageLocally(fileBuffer, originalname);
};
