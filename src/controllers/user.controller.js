import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { createUser, loginUser } from "../services/user.service.js";

// POST /api/users
// Reads { username } from body, delegates to service, returns 201.
const createUserController = asyncHandler(async (req, res) => {
  const { username } = req.body;

  const user = await createUser({ username });

  return res.status(201).json(new ApiResponse(201, user, "User created"));
});

// POST /api/users/login
// Reads { username } from body, looks up the existing user, returns 200.
const loginUserController = asyncHandler(async (req, res) => {
  const { username } = req.body;

  const user = await loginUser({ username });

  return res.status(200).json(new ApiResponse(200, user, "Login successful"));
});

export { createUserController, loginUserController };
