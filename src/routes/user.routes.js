import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../middlewares/validate.js";
import { createUserController, loginUserController } from "../controllers/user.controller.js";

const router = Router();

const usernameRules = [
  body("username")
    .notEmpty()
    .withMessage("username is required")
    .isLength({ min: 2, max: 30 })
    .withMessage("username must be 2–30 characters"),
];

// POST /api/users
router.post("/", usernameRules, validate, createUserController);

// POST /api/users/login
router.post("/login", usernameRules, validate, loginUserController);

export default router;
