
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { INITIAL_CONTACTS, INITIAL_MESSAGES, THEMES } from "../constants";
import { formatRelativeTime } from "../utils";
import { BASE_URL } from "../lib/axios"; // [FIX] Import single source of truth

export const useChat = () => {
  // --- STATE MANAGEMENT ---
  const [user, setUser] = useState<any>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<any[]>(INITIAL_CONTACTS);
  const [messages, setMessages] = useState<any>(INITIAL_MESSAGES);

  // UI State
  const [viewingProfile, setViewingProfile] = useState<any>(null);
  const [previewProfile, setPreviewProfile] = useState<any>(null);
  const [detailedProfile, setDetailedProfile] = useState<any>(null);
  const [currentThemeId, setCurrentThemeId] = useState(
    () => localStorage.getItem("theme") || "light",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [showSidebarMenu, setShowSidebarMenu] = useState(false);

  // Input State
  const [inputText, setInputText] = useState("");
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, any>>({});
  const [smartReplies] = useState<string[]>([]);

  // Call State
  const [callStatus, setCallStatus] = useState<
    "idle" | "ringing" | "connected" | "ended" | "incoming"
  >("idle");
  const [callType, setCallType] = useState<"audio" | "video">("audio");

  const socket = useRef<any>(null);
  const callStartTime = useRef<number | null>(null);

  const theme = THEMES[currentThemeId as keyof typeof THEMES];

  // [FIX] Use the imported BASE_URL
  const API_URL = BASE_URL;

  const activeContact = useMemo(
    () => contacts.find((c) => c.id === activeChatId),
    [contacts, activeChatId],
  );

  const handleUpdateContact = useCallback(
    (updatedContact: any) => {
      setContacts((prev) =>
        prev.map((c) => (c.id === updatedContact.id ? updatedContact : c)),
      );
      if (updatedContact.id === "me" || updatedContact.id === user?.id)
        setUser((prev: any) => ({ ...prev, ...updatedContact }));
      if (viewingProfile?.id === updatedContact.id)
        setViewingProfile(updatedContact);
      if (previewProfile?.id === updatedContact.id)
        setPreviewProfile(updatedContact);
      if (detailedProfile?.id === updatedContact.id)
        setDetailedProfile(updatedContact);
    },
    [user, viewingProfile, previewProfile, detailedProfile],
  );

  // --- EFFECT 1: AUTHENTICATION (Fetch User Only) ---
  useEffect(() => {
    let isMounted = true;

    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_URL}/api/current_user`, {
          credentials: "include",
        });
        if (res.ok) {
          const userData = await res.json();
          if (isMounted && userData && userData.googleId) {
            setUser({
              id: userData._id,
              _id: userData._id,
              name: userData.displayName,
              avatar: userData.avatar,
              email: userData.email,
              shareId: userData.shareId,
              status: "online",
              about: userData.bio || "Hey!",
              isAI: false,
              contacts: userData.contacts,
            });
          }
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      }
    };

    fetchUser();

    return () => {
      isMounted = false;
    };
  }, [API_URL]);

  // --- EFFECT 2: SOCKET CONNECTION (Runs when User is set) ---
  useEffect(() => {
    if (!user?._id) return;

    // Initialize Socket
    const newSocket = io(API_URL, { transports: ["websocket"] });
    socket.current = newSocket;
    newSocket.emit("addUser", user._id);

    // 1. CALL EVENTS
    newSocket.on("incomingCall", ({ type }: any) => {
      setCallStatus("incoming");
      setCallType(type);
    });

    newSocket.on("callAccepted", () => {
      setCallStatus("connected");
      callStartTime.current = Date.now();
    });

    newSocket.on("callEnded", () => {
      setCallStatus("ended");
      setTimeout(() => setCallStatus("idle"), 1000);
    });

    newSocket.on("userOffline", () => {
      alert("User is offline or not reachable!");
      setCallStatus("idle");
    });
    // 🔥 Presence events
    // newSocket.on("userOnline", (userId: string) => {
    //   setContacts((prev) =>
    //     prev.map((c) => (c.id === userId ? { ...c, status: "online" } : c)),
    //   );
    // });

    // newSocket.on("userOffline", (userId: string) => {
    //   setContacts((prev) =>
    //     prev.map((c) => (c.id === userId ? { ...c, status: "offline" } : c)),
    //   );
    // });

    // 2. MESSAGE EVENTS
    newSocket.on("getMessage", (data: any) => {
      setMessages((prev: any) => {
        const chatId = data.sender === user._id ? data.receiver : data.sender;
        const newMsg = {
          id: data._id,
          text: data.text,
          time: formatRelativeTime(data.timestamp),
          sender: data.sender === user._id ? "me" : "them",
          isRead: false,
          status: "sent",
          type:
            data.type ||
            (data.fileUrl
              ? data.fileType?.startsWith("image")
                ? "image"
                : "file"
              : "text"),

          fileUrl: data.fileUrl ? `${API_URL}${data.fileUrl}` : undefined,
          fileName: data.fileName || null,
          replyTo: data.replyTo || null,
          callDetails: data.callDetails || null,
        };

        return {
          ...prev,
          [chatId]: [...(prev[chatId] || []), newMsg],
        };
      });
    });

    // Process Contacts
    if (user.contacts?.length > 0) {
      const dbContacts = user.contacts.map((c: any) => {
        let lastMsgPreview = "No messages yet",
          lastMsgTime = "",
          lastMsgType = "text";
        if (c.lastMessageDoc) {
          lastMsgType = c.lastMessageDoc.type || "text";
          lastMsgTime = formatRelativeTime(c.lastMessageDoc.timestamp);
          lastMsgPreview =
            c.lastMessageDoc.sender === user._id
              ? `You: ${c.lastMessageDoc.text}`
              : c.lastMessageDoc.text;
        }
        const lastSeenDate = c.lastSeen ? new Date(c.lastSeen) : new Date(0);
        const isOnline = new Date().getTime() - lastSeenDate.getTime() < 120000;
        
        return {
          id: c._id,
          name: c.displayName,
          avatar: c.avatar,
          status: isOnline ? "online" : "offline",
          about: c.bio,
          isAI: false,
          lastMessage: lastMsgPreview,
          lastMessageTime: lastMsgTime,
          lastMessageType: lastMsgType,
        };
      });
      setContacts([...INITIAL_CONTACTS, ...dbContacts]);
    }

    return () => {
      newSocket.disconnect();
    };
  }, [user?._id, API_URL]);

  // --- MESSAGE FETCHING ---
  const fetchMessages = useCallback(
    async (contactId: string) => {
      if (!user || !contactId || contactId === "nebula-ai") return;
      try {
        const res = await fetch(`${API_URL}/api/messages/${contactId}`, {
          credentials: "include",
        });
        if (res.ok) {
          const dbMessages = await res.json();
          const formattedMessages = dbMessages.map((m: any) => ({
            id: m._id,
            senderId: m.sender,
            text: m.text,
            time: formatRelativeTime(m.timestamp),
            sender: m.sender === user.id ? "me" : "them",
            status: "read",
            type:
              m.type ||
              (m.fileUrl
                ? m.fileType?.startsWith("image")
                  ? "image"
                  : "file"
                : "text"),
            fileUrl: m.fileUrl ? `${API_URL}${m.fileUrl}` : undefined,
            fileName: m.fileName,
            callDetails: m.callDetails,
            replyTo: m.replyTo,
          }));

          setMessages((prev: any) => {
            // Merge old messages with new ones, avoid duplicates
            const existing = prev[contactId] || [];
            const existingIds = new Set(existing.map((m: any) => m.id));
            const merged = [
              ...existing,
              ...formattedMessages.filter((m: any) => !existingIds.has(m.id)),
            ];
            return { ...prev, [contactId]: merged };
          });
        }
      } catch (err) {
        console.error(err);
      }
    },
    [user, API_URL],
  );

  useEffect(() => {
    if (!activeChatId || activeChatId === "nebula-ai") return;
    fetchMessages(activeChatId);
  }, [activeChatId, fetchMessages]);

  // --- ACTIONS: SEND MESSAGE ---
  const handleSendMessage = useCallback(
    async (
      content: string,
      type = "text",
      callDetails: any = null,
      fileUrl: string | null = null,
    ) => {
      if (!activeChatId || !user) return;
      const contact = contacts.find((c) => c.id === activeChatId);
      if (contact?.isAI) return;

      const newMsg = {
        id: `temp-${Date.now()}`, // temporary ID until server responds
        sender: "me",
        senderId: user.id,
        text: content,
        time: formatRelativeTime(new Date().toISOString()),
        status: "sent",
        type,
        fileUrl,
        callDetails,
        replyTo: replyingTo ? replyingTo.id : null,
        isRead: true,
      };

      // **Add message locally first**
      setMessages((prev: any) => ({
        ...prev,
        [activeChatId]: [...(prev[activeChatId] || []), newMsg],
      }));

      if (type === "text") {
        setInputText("");
        setReplyingTo(null);
        setDrafts((prev) => ({ ...prev, [activeChatId]: "" }));
      }

      try {
        const res = await fetch(`${API_URL}/api/messages/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            sender: user.id,
            receiverId: activeChatId,
            text: content,
            type,
            replyTo: replyingTo ? replyingTo.id : null,
            callDetails,
            fileUrl,
          }),
        });

        if (res.ok) {
          // Optionally, replace temp ID with server ID
          const savedMsg = await res.json();
          setMessages((prev: any) => ({
            ...prev,
            [activeChatId]: prev[activeChatId].map((m: any) =>
              m.id === newMsg.id
                ? {
                    ...m,
                    id: savedMsg._id,
                    time: formatRelativeTime(savedMsg.timestamp),
                  }
                : m,
            ),
          }));
        }
      } catch (err) {
        alert("Failed to send message.");
        // Optional: remove failed message
        setMessages((prev: any) => ({
          ...prev,
          [activeChatId]: prev[activeChatId].filter(
            (m: any) => m.id !== newMsg.id,
          ),
        }));
      }
    },
    [activeChatId, contacts, replyingTo, user, API_URL],
  );
  // --- ACTIONS: UPLOAD FILE ---
  const handleFileUpload = async (file: File) => {
    if (!activeChatId || !user) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("sender", user.id);
    formData.append("receiver", activeChatId);

    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (data.success) {
        // Automatically send the message now that upload is done
        const fileType = file.type.startsWith("image") ? "image" : "file";
        await handleSendMessage(file.name, fileType, null, data.fileUrl);
      }
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  };

  // --- ACTIONS: CALLS ---
  const startCall = (type: "audio" | "video") => {
    if (!activeChatId) return;
    setCallType(type);
    setCallStatus("ringing");
    socket.current?.emit("callUser", {
      senderId: user.id,
      receiverId: activeChatId,
      type,
    });
  };

  const answerCall = () => {
    setCallStatus("connected");
    callStartTime.current = Date.now();
    if (activeChatId)
      socket.current?.emit("answerCall", {
        senderId: user.id,
        receiverId: activeChatId,
      });
  };

  const endCall = () => {
    if (activeChatId)
      socket.current?.emit("endCall", {
        senderId: user.id,
        receiverId: activeChatId,
      });

    let durationStr = "00:00";
    if (callStatus === "connected" && callStartTime.current) {
      const diff = Math.floor((Date.now() - callStartTime.current) / 1000);
      const mins = Math.floor(diff / 60)
        .toString()
        .padStart(2, "0");
      const secs = (diff % 60).toString().padStart(2, "0");
      durationStr = `${mins}:${secs}`;
    }
    const text = callType === "video" ? "Video Call" : "Audio Call";
    const status = callStatus === "connected" ? "ended" : "missed";

    handleSendMessage(text, "call", {
      status,
      duration: status === "missed" ? "" : durationStr,
    });

    setCallStatus("ended");
    setTimeout(() => setCallStatus("idle"), 1000);
  };

  // --- ACTIONS: CONTACTS & PROFILE ---
  const handleChatSelect = useCallback(
    (newChatId: string | null) => {
      if (activeChatId) {
        setDrafts((prev) => ({ ...prev, [activeChatId]: inputText }));
        setReplyDrafts((prev) => ({ ...prev, [activeChatId]: replyingTo }));
      }
      setActiveChatId(newChatId);
      if (newChatId) {
        setInputText(drafts[newChatId] || "");
        setReplyingTo(replyDrafts[newChatId] || null);
      } else {
        setInputText("");
        setReplyingTo(null);
      }
    },
    [activeChatId, inputText, replyingTo, drafts, replyDrafts],
  );

  const addContactByCode = useCallback(
    async (shareCode: string) => {
      try {
        const res = await fetch(`${API_URL}/api/contacts/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ targetShareId: shareCode }),
        });
        if (res.ok) {
          const newContact = await res.json();
          setContacts((prev) => {
            if (prev.find((c) => c.id === newContact._id)) return prev;
            return [
              ...prev,
              {
                id: newContact._id,
                name: newContact.displayName,
                avatar: newContact.avatar,
                status: "offline",
                about: newContact.bio,
                isAI: false,
              },
            ];
          });
          alert(`Added ${newContact.displayName}!`);
        } else {
          alert("User not found");
        }
      } catch (e) {
        alert("Connection error");
      }
    },
    [API_URL],
  );

  const updateMyProfile = useCallback(
    async (updates: any) => {
      try {
        const res = await fetch(`${API_URL}/api/user/update`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(updates),
        });
        if (res.ok) {
          const updatedData = await res.json();
          setUser((prev: any) => ({
            ...prev,
            name: updatedData.displayName,
            about: updatedData.bio,
            avatar: updatedData.avatar,
          }));
          return true;
        } else {
          return false;
        }
      } catch (err) {
        return false;
      }
    },
    [API_URL],
  );

  const toggleTheme = () => {
    const newTheme = currentThemeId === "light" ? "dark" : "light";
    setCurrentThemeId(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  return {
    user,
    setUser,
    activeChatId,
    setActiveChatId: handleChatSelect,
    contacts,
    messages: activeChatId ? messages[activeChatId] || [] : [],
    theme,
    toggleTheme,
    inputText,
    setInputText,
    searchTerm,
    setSearchTerm,
    replyingTo,
    setReplyingTo,
    smartReplies,
    activeContact,
    handleSendMessage,
    handleFileUpload,
    addContactByCode,
    updateMyProfile,
    callStatus,
    startCall,
    endCall,
    callType,
    answerCall,
    showSidebarMenu,
    setShowSidebarMenu,
    viewingProfile,
    setViewingProfile,
    previewProfile,
    setPreviewProfile,
    detailedProfile,
    setDetailedProfile,
    handleUpdateContact,
  };
};
