import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/fileUpload.js"
import { ApiResponse } from "../utils/Apiresponse.js"

const registerUser = asyncHandler( async (req, res) =>{

    const {fullName, email, username, password} = req.body  //get user details from frontend
    console.log("email:", email);

   if(
    [fullName, email, username, password].some((field) => //validation
        field?.trim() === "")
    ) {
            throw new ApiError(400, "All fields are required")
    }

    const existedUser = User.findOne({      //check if user already exists
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email and username already exists!")
    }
   
     const avatarLocalPath = req.files?.avatar[0]?.path;            //check for avatar and cover image
     const coverImageLocalPath = req.files?.coverImage[0]?.path;

     if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
     }

     const avatar = await uploadOnCloudinary(avatarLocalPath)       //upload them to cloudinary    
     const coverImage = await uploadOnCloudinary(coverImageLocalPath)

     if(!avatar){
        throw new ApiError(400, "Avatar file is required")
     }
     
     const user = await User.create({        //create User c=object entry in db
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
     })

     const createdUser = await User.findById(user._id).select(   //Remove password and refresh token
        "-password -refreshToken"
     )

     if (!createdUser){                                           //check for user creation
        throw new ApiError(500, "Something went wrong while registering a user!")
     }
    
     return res.status(201).json(                                 //return response
        new ApiResponse(200, createdUser, "User registered successfully!")
     )


}) 

export {registerUser}