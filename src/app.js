import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express()

app.use(cors({                           //Cross Origin Resource Sharing
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({limit: "16kb"}))                      //To accept data in request through forms

app.use(express.urlencoded({extended: true, limit:"16kb"})) //To accept data in request through url

app.use(express.static("public"))                           //To store some files (images, favicon, etc) if there in Public folder

app.use(cookieParser())                                     //To access and set cookies of user's browser through our server


//routes import

import userRouter from "./routes/user.routes.js"

//routes declaration

app.use("/api/v1/users", userRouter)

export {app}