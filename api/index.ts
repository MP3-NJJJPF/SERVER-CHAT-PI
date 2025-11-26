import { Server, type Socket } from "socket.io";
import "dotenv/config";
import { apiClient } from "./fetch/fetchClient.js";

/**
 * Loads allowed CORS origins from the ORIGIN environment variable.
 * ORIGIN can contain multiple origins separated by commas.
 * Example: ORIGIN="http://localhost:5173, https://mywebsite.com"
 */
const origins = (process.env.ORIGIN ?? "")
    .split(",")              // Split by commas
    .map(s => s.trim())      // Remove extra whitespace
    .filter(Boolean);        // Remove empty strings

/**
 * Initializes the Socket.io server with CORS configuration.
 */
const io = new Server({
    cors: {
        origin: origins
    }
});

const port = Number(process.env.PORT);

/**
 * Starts the server on the specified port.
 */
io.listen(port);
console.log(`Server is running on port ${port}`);

/**
 * Useful types for managing connected users and chat messages
 */
type OnlineUser = { socketId: string; userId: string, name?: string; photo?: string; };
type ChatMessagePayload = {
    userId: string;
    message: string;
    timestamp?: string;
};

/**
 * In-memory storage of online users organized by room.
 * Each room has its own array of connected users with their socket and user information.
 */
const onlineUsersByRoom: Record<string, {
    socketId: string;
    userId: string;
    name: string;
    photo: string;
}[]> = {};

/**
 * In-memory list of connected users.
 * Each entry represents an individual socket connection.
 */
let onlineUsers: OnlineUser[] = [];

/**
 * Main event: "connection"
 * Executes every time a client connects to the WebSocket server.
 */
io.on("connection", (socket: Socket) => {
    /**
     * Event: "newUser"
     * Handles when a user joins a meeting room.
     * Manages user registration, reconnections, and multi-tab scenarios.
     */
    socket.on("newUser", async (userData) => {
        const { userId, name, photo, roomId } = userData;

        // Prevent invalid data from being processed
        if (!userId || !roomId) return;

        // Create the room if it doesn't exist yet
        if (!onlineUsersByRoom[roomId]) {
            onlineUsersByRoom[roomId] = [];
        }

        // Get the list of users ONLY for this specific room
        let users = onlineUsersByRoom[roomId];

        // Check if this socket is already registered in the room
        const existingUserIndex = users.findIndex(
            user => user.socketId === socket.id
        );

        if (existingUserIndex !== -1) {
            // Case 1: Socket already exists in the room
            // Update the existing entry with new user data (userId, name, photo)
            users[existingUserIndex] = {
                socketId: socket.id,
                userId,
                name,
                photo
            };

        } else if (!users.some(user => user.userId === userId)) {
            // Case 2: This userId doesn't exist in the room yet
            // Add them as a new user to the room
            users.push({
                socketId: socket.id,
                userId,
                name,
                photo
            });

            // Notify the backend to add this participant to the meeting
            await apiClient.post(`/api/v1/meetings/add-participant`, { meetingId: roomId, userId: userId, name: name });
        } else {
            // Case 3: UserId already exists but with a different socket
            // This happens when:
            // - User opened another tab
            // - User reloaded the page
            // - User reconnected due to poor network connection
            // Update their socket ID to the new one
            users = users.map(user =>
                user.userId === userId
                    ? { socketId: socket.id, userId, name, photo }
                    : user
            );

            onlineUsersByRoom[roomId] = users;
        }

        // Join the socket to the correct room
        socket.join(roomId);

        // Notify ONLY the users in this specific room about the updated user list
        io.to(roomId).emit("usersOnline", onlineUsersByRoom[roomId]);
    });

    /**
     * Event: "disconnect"
     * Executes when a client disconnects from the server.
     * Removes the user from all rooms they were part of and notifies remaining users.
     */
    socket.on("disconnect", async () => {
        // Iterate through all rooms to find and remove the disconnected user
        for (const roomId in onlineUsersByRoom) {
            // Find the user to remove based on their socket ID
            const userToRemove = onlineUsersByRoom[roomId].find(
                u => u.socketId === socket.id
            );
            // Store the count before removal for comparison
            const before = onlineUsersByRoom[roomId].length;

            // Remove the user from the room's user list
            onlineUsersByRoom[roomId] = onlineUsersByRoom[roomId].filter(
                u => u.socketId !== socket.id
            );

            // Check if a user was actually removed (count changed)
            if (before !== onlineUsersByRoom[roomId].length) {
                // If we found the user, notify the backend to remove them from the meeting
                if (userToRemove) {
                    await apiClient.post(`/api/v1/meetings/remove-participant`, { meetingId: roomId, userId: userToRemove.userId, name: userToRemove.name });
                }
                // Notify only the users in this room about the updated user list
                io.to(roomId).emit("usersOnline", onlineUsersByRoom[roomId]);
            }
        }
    });

    /**
     * Event: "chat:message"
     * Handles incoming chat messages from clients and broadcasts them to all users.
     */
    socket.on("chat:message", (payload: ChatMessagePayload) => {
        const trimmedMessage = payload?.message?.trim();
        if (!trimmedMessage) return;

        let sender = null;
        let senderRoomId = null;

        // Buscar al usuario Y su sala
        for (const rid in onlineUsersByRoom) {
            const found = onlineUsersByRoom[rid].find(
                (u) => u.socketId === socket.id
            );

            if (found) {
                sender = found;
                senderRoomId = rid; // ⬅️ AQUI GUARDAMOS LA SALA
                break;
            }
        }

        const outgoingMessage = {
            userId: payload.userId,
            message: trimmedMessage,
            timestamp: payload.timestamp ?? new Date().toISOString(),
            name: sender?.name ?? null,
            photo: sender?.photo ?? null,
        };

        if (senderRoomId) {
            io.to(senderRoomId).emit("chat:message", outgoingMessage);
        }

        console.log("Relayed chat:", outgoingMessage);
    });

    /**
     * Event: "leave-call"
     * Handles when a user explicitly leaves a call/meeting.
     * Removes them from the room and notifies the backend and other participants.
     */
    socket.on("leave-call", async ({ roomId }) => {
        // Exit early if no room ID is provided
        if (!roomId) return;

        // Get the users in this specific room
        const users = onlineUsersByRoom[roomId];
        if (!users) return;

        // Find the user who is leaving based on their socket ID
        const userToRemove = users.find(u => u.socketId === socket.id);

        // Remove the user from the room's user list
        onlineUsersByRoom[roomId] = users.filter(
            u => u.socketId !== socket.id
        );

        // If a user was actually found and removed, update the backend
        if (userToRemove) {
            await apiClient.post(`/api/v1/meetings/remove-participant`, {
                meetingId: roomId,
                userId: userToRemove.userId,
                name: userToRemove.name,
            });
            console.log("User", userToRemove.userId)
        }

        // Remove the socket from the Socket.io room
        socket.leave(roomId);

        // Notify ONLY the users in this room about the updated user list
        io.to(roomId).emit("usersOnline", onlineUsersByRoom[roomId]);
    });
});