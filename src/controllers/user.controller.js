import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { createUser } from "../services/user.service.js";

// POST /api/users
// Reads { username } from body, delegates to service, returns 201.
const createUserController = asyncHandler(async (req, res) => {
  const { username } = req.body;

  const user = await createUser({ username });

  return res.status(201).json(new ApiResponse(201, user, "User created"));
});

export { createUserController };
