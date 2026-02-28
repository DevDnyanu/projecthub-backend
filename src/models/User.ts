import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  avatar: string;
  role: "buyer" | "seller" | "admin";
  rating: number;
  ratingCount: number;
  completedProjects: number;
  linkedinUrl: string;
  skills: string[];
  experienceLevel: string;
  yearsOfExperience: number;
  bio: string;
  portfolioUrl: string;
  availability: string;
  isEmailVerified: boolean;
  emailVerifyToken: string;
  passwordResetToken: string;
  passwordResetExpires: Date | undefined;
  createdAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name:               { type: String, required: true, trim: true },
    email:              { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:           { type: String, required: true, minlength: 6 },
    avatar:             { type: String, default: "" },
    role:               { type: String, enum: ["buyer", "seller", "admin"], default: "buyer" },
    rating:             { type: Number, default: 0, min: 0, max: 5 },
    ratingCount:        { type: Number, default: 0 },
    completedProjects:  { type: Number, default: 0 },
    linkedinUrl:        { type: String, default: "" },
    skills:             [{ type: String }],
    experienceLevel:    { type: String, enum: ["Junior", "Mid-Level", "Senior", "Expert", ""], default: "" },
    yearsOfExperience:  { type: Number, default: 0, min: 0, max: 50 },
    bio:                { type: String, default: "" },
    portfolioUrl:       { type: String, default: "" },
    availability:       { type: String, enum: ["Full-Time", "Part-Time", "Weekends Only", ""], default: "" },
    isEmailVerified:       { type: Boolean, default: false },
    emailVerifyToken:      { type: String, default: "" },
    passwordResetToken:    { type: String, default: "" },
    passwordResetExpires:  { type: Date },
  },
  { timestamps: true }
);

UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model<IUser>("User", UserSchema);
