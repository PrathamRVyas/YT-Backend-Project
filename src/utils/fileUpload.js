import dotenv from "dotenv";

dotenv.config();

import ImageKit from "imagekit";
import fs from "fs";

const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

const uploadOnImageKit = async (localFilePath) => {
    try {
        if (!localFilePath) return null;

        const response = await imagekit.upload({
            file: fs.readFileSync(localFilePath),
            fileName: `${Date.now()}-${localFilePath.split(/[\\/]/).pop()}`
        });

        console.log("ImageKit Upload Success:", response);

        fs.unlinkSync(localFilePath);

        return response;
    } catch (error) {
        console.error("ImageKit Error:", error);

        if (localFilePath && fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }

        return null;
    }
};

export { uploadOnImageKit };