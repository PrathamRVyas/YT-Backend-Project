import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnImageKit } from "../utils/fileUpload.js";
import { ApiResponse } from "../utils/Apiresponse.js";

const registerUser = asyncHandler(async (req, res) => {

    // Get user details sent from the frontend
    const { fullName, email, username, password } = req.body;

    // Check if any required field is empty
    if (
        [fullName, email, username, password].some(
            (field) => field?.trim() === ""
        )
    ) {
        throw new ApiError(400, "All fields are required");
    }

    // Check if a user with the same email or username already exists
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists!");
    }

    // Get local paths of uploaded files from Multer
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    // Avatar is mandatory during registration
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    // Upload avatar to ImageKit
    const avatar = await uploadOnImageKit(avatarLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Failed to upload avatar");
    }

    // Upload cover image only if user has selected one
    const coverImage = coverImageLocalPath
        ? await uploadOnImageKit(coverImageLocalPath)
        : null;

    // Create a new user in the database
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    });

    // Fetch user again without password and refresh token
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    // Safety check in case user creation fails
    if (!createdUser) {
        throw new ApiError(
            500,
            "Something went wrong while registering the user!"
        );
    }

    // Send success response
    return res.status(201).json(
        new ApiResponse(
            201,
            createdUser,
            "User registered successfully!"
        )
    );
});

const loginUser = asyncHandler(async (req, res) => {

});

export { registerUser, loginUser };