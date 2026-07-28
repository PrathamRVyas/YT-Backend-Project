import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnImageKit } from "../utils/fileUpload.js";
import { ApiResponse } from "../utils/Apiresponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async(userId) =>{
   try {
      const user = await User.findById(userId)
      const accessToken = await user.generateAccessToken()
      const refreshToken = await user.generateRefreshToken()

      user.refreshToken = refreshToken
      await user.save({validateBeforeSave: false})

      return {accessToken, refreshToken}

   } catch (error) {
      console.error(error);
      throw new ApiError(500, "Something went wrong while generating access and refresh token")
   }
}

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

    // Upload avatar
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
    const {email, username, password} = req.body                //Get username email pass
    console.log(email);

    if(!(username || email)){                                    //Check for anyone
      throw new ApiError(400, "Username or Email required!")
    }

    const user = await User.findOne(                       //Find user based on anyone (email/username)
      {
         $or: [{ username }, { email }]
      })

      if(!user) {                                         //Error if user not found
         throw new ApiError(404, "User does not exist")
      }

      const isPasswordValid = await user.isPasswordCorrect(password)

       if(!isPasswordValid) {                                         //Error if password incorrect
         throw new ApiError(401, "Invalid user credentials")
      }

      const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)   //Generate access and refresh token

      const loggedInUser = await User.findById(user._id).select("-password -refreshToken") 

      const options = {                                                                    //Options for sending cookies
         httpOnly: true, 
         secure: true      //To make cookies editable by server only and not user
      }

      return res                                                                       //Return cookies and logged in user
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
         new ApiResponse(
            200,
            {
               user: loggedInUser, accessToken, refreshToken
            },
            "User logged in Successfully"
         )
      )

});

const logoutUser =  asyncHandler(async (req,res) =>{
      await User.findByIdAndUpdate(
         req.user._id,
         {
            $set: {
               refreshToken: undefined
            }
         },
         {
            new: true
         }
      )

       const options = {                                                                    
         httpOnly: true, 
         secure: true      
      }

      return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new ApiResponse(200), {}, "User logged out!")

})

const refreshAccessToken = asyncHandler(async (req,res) =>{
   const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken //Mobile app

   if(!incomingRefreshToken){
      throw new ApiError(401, "unauthorized request")
   }

 try {
     const decodedToken = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
     )
  
     const user = await User.findById(decodedToken?._id)
  
     if(!user){
        throw new ApiError(401, "Invalid refresh Token")
     }
  
     if(incomingRefreshToken != user?.refreshToken){
        throw new ApiError(401, "Refresh token is expired or used")
     }
  
     const options = {
        httpOnly: true,
        secure: true
     }
  
     const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
  
     return res
     .status(200)
     .cookie("accessToken", accessToken, options)
     .cookie("refreshToken", newRefreshToken, options)
     .json(
        new ApiResponse(
           200,
           {accessToken, refreshToken: newRefreshToken},
           "Access token refreshed"
        )
     )
 } catch (error) {
    throw new ApiError(4001, error?.message || "Invalid refresh token")
   
 }

})

const changeCurrentPassword = asyncHandler(async (req,res) =>{
    const {oldPassword, newPassword, confirmPassword} = req.body

    if(!(newPassword === confirmPassword)){
      throw new ApiError(400, "new password and confirm password do not match")
    }

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
      throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password updated successfully!"))

})

const getCurrentUser = asyncHandler(async(req, res) =>{
   return res
   .status(200)
   .json(new ApiResponse(200, req.user, "current user fetched successfully"))
})

const updateAccountDetails = asyncHandler(async(req,res) =>{
   const {fullName, email} = req.body

   if(!fullName || !email){
      throw new ApiError(400, "All fields are required")
   }

   const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
         $set: {
            fullName,
            email
         }
      },
      {new: true}
   ).select("-password")

   return res
   .status(200)
   .json(new ApiResponse(200, user, "Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async(req,res) =>{
   const avatarLocalPath = req.file?.path

   if(!avatarLocalPath){
      throw new ApiError(400, "Avatar file is required")
   }

   const avatar = await uploadOnImageKit(avatarLocalPath);

   if (!avatar?.url) {
    throw new ApiError(500, "Failed to update avatar");
   } 

   const user =  await User.findByIdAndUpdate(
      req.user?._id,
      {
         $set: {
            avatar: avatar.url
         }
      },
      {new: true}
   ).select("-password")

   return res
   .status(200)
   .json(new ApiResponse(200, user, "Avatar updated successfully"))
   
})

const updateUserCoverImage = asyncHandler(async(req,res) =>{
   const coverImageLocalPath = req.file?.path

   if(!coverImageLocalPath){
      throw new ApiError(400, "Cover Image file is required")
   }

   const coverImage = await uploadOnImageKit(coverImageLocalPath);

   if (!coverImage?.url) {
    throw new ApiError(500, "Failed to update cover image");
   } 

   const user =  await User.findByIdAndUpdate(
      req.user?._id,
      {
         $set: {
            coverImage: coverImage.url
         }
      },
      {new: true}
   ).select("-password")

   return res
   .status(200)
   .json(new ApiResponse(200, user, "Cover Image updated successfully"))
   
})

const getUserChannelProfile = asyncHandler(async (req,res) =>{
      const {username} = req.params

      if(!username?.trim()){
         throw new ApiError(404, "username not found")
      }

      const channel =  await User.aggregate([
         {
            $match:{
               username: username?.toLowerCase()
            }
         },
         {
            $lookup:{
               from:"subscriptions",
               localField:"_id",
               foreignField:"channel",
               as:"subscribers"
            }
         },
         {
            $lookup:{
               from:"subscriptions",
               localField:"_id",
               foreignField:"subscriber",
               as:"subscribedTo"
            }
         },
         {
            $addFields:{
               subscribersCount: {
                  $size: "$subscribers"
               },
               channelsSubscribedToCount: {
                  $size: "$subscribedTo"
               },
               isSubscribed: {
                  $condition:{
                     if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                     then: true,
                     else: false
                  }
               }
            }
         },
         {
            $project:{
               fullName: 1,
               username: 1,
               subscribersCount: 1,
               channelsSubscribedToCount: 1,
               isSubscribed: 1,
               avatar: 1,
               coverImage: 1,
               email: 1
            }
         }

      ])

      if(!channel?.length){
         throw new ApiError(404, "channel does not exists")
      }

      return res
      .status(200)
      .json(
         new ApiResponse(200, "User channel fetched successfully")
      )
})

const getWatchHistory = asyncHandler(async(req,res) =>{
   const user = await User.aggregate([
      {
         $match: {
            _id: new mongoose.Types.ObjectId(req.user._id)
         }
      },
      {
         $lookup: {
            from:"videos",
            localField:"watchHistory",
            foreignField:"_id",
            as:"watchHistory",
            pipeline:[
               {
                  $lookup:{
                     from:"users",
                     localField:"owner",
                     foreignField:"_id",
                     as:"owner",
                     pipeline: [
                        {
                           $project: {
                              fullName: 1,
                              username: 1,
                              avatar: 1
                           }
                        }
                     ]
                  }
               },
               {
                  $addFields:{
                     owner:{
                        $first: "$owner"
                     }
                  }
               }
            ]
         }
      }
   ])

   return res
   .status(200)
   .json(
      new ApiResponse(
         200,
         user[0].watchHistory,
         "Watch history fetched successfully"
      )
   )
})

export { registerUser,
         loginUser,
         logoutUser,
         refreshAccessToken,
         changeCurrentPassword,
         getCurrentUser,
         updateAccountDetails,
         updateUserAvatar,
         updateUserCoverImage,
         getUserChannelProfile,
         getWatchHistory
      };