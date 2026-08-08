import React, { useState, useEffect, useRef } from 'react';
import {
  Phone, Video, Search, Paperclip,
  Send, User, Sparkles, Trash2, UserPlus, Info, PhoneOff,
  Circle, Shield, Sun, Moon, LogOut, Bot, X, Check, CheckCheck, Volume2, VolumeX
} from 'lucide-react';

// Default Gemini API configuration for Vite
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const MODEL_NAME = "gemini-2.5-flash";

// Type Interfaces
interface Friend {
  id: string;
  name: string;
  avatar: string;
  emoji: string;
  status: string;
  tagline: string;
  personality: string;
  greeting: string;
  themeColor: string;
}

interface Message {
  id: string;
  sender: 'user' | 'friend';
  text: string;
  image?: string | null;
  timestamp: string;
  status: 'read';
}

interface UserAccount {
  id: string;
  username: string;
  avatar: string;
  joinedAt: string;
}

interface ActiveCall {
  friend: Friend;
  type: 'audio' | 'video';
  status: 'ringing' | 'connected';
}

// Initial standard AI Friends
const DEFAULT_FRIENDS: Friend[] = [
  {
    id: 'aria-1',
    name: 'Aria',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    emoji: '✨',
    status: 'online',
    tagline: 'Your bubbly bestie & late-night listener',
    personality: 'You are Aria, a warm, energetic, and deeply empathetic best friend chatting on WhatsApp. You use casual texting style, occasional emojis, short-to-medium length messages, and sound genuinely caring and fun. Ask follow-up questions and react warmly.',
    greeting: 'Heyyy! 👋 So glad you messaged! How was your day today? Spill all the details! ✨',
    themeColor: '#e91e63'
  },
  {
    id: 'leo-2',
    name: 'Leo',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    emoji: '🔥',
    status: 'online',
    tagline: 'Witty, sarcastic & roasts you with love',
    personality: 'You are Leo, a witty, slightly sarcastic, banter-loving best buddy chatting on WhatsApp. You love teasing playfully, using casual internet slang, giving honest advice, and making jokes. Keep replies concise and punchy like real text messages.',
    greeting: 'Look who finally decided to text me 🥱 What shenanigans are we getting into today?',
    themeColor: '#ff9800'
  },
  {
    id: 'mina-3',
    name: 'Mina',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    emoji: '🌿',
    status: 'online',
    tagline: 'Calm, wise & cozy mindfulness companion',
    personality: 'You are Mina, a peaceful, wise, and comforting friend. You speak calmly, offer thoughtful perspectives, help de-stress, and encourage self-care. Use soft language and gentle tone.',
    greeting: 'Hello my friend 🌿 Take a deep breath. How are you feeling in this moment?',
    themeColor: '#4caf50'
  },
  {
    id: 'kai-4',
    name: 'Techie Kai',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    emoji: '🤖',
    status: 'online',
    tagline: 'Sci-fi geek, coding buddy & tech enthusiast',
    personality: 'You are Kai, a passionate tech nerd, gamer, and sci-fi geek chatting on WhatsApp. You love talking about AI, futuristic tech, gadgets, gaming, and coding. Energetic and inquisitive.',
    greeting: 'Yo! 🚀 Just testing out a new setup. Did you check out the latest tech news today?',
    themeColor: '#2196f3'
  }
];

// Retry fetch with exponential backoff for Gemini API
async function callGeminiAPI(
  messages: Message[],
  systemInstruction: string,
  base64Image: string | null = null,
  maxRetries = 5
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
  
  // Format history into Gemini API structure
  const formattedContents = messages.map((msg, index) => {
    const role = msg.sender === 'user' ? 'user' : 'model';
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [{ text: msg.text }];
    
    // Attach image to the latest user message if present
    if (msg.sender === 'user' && index === messages.length - 1 && base64Image) {
      const mimeType = base64Image.split(';')[0].split(':')[1] || 'image/jpeg';
      const base64Data = base64Image.split(',')[1];
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      });
    }

    return { role, parts };
  });

  const payload = {
    contents: formattedContents,
    systemInstruction: {
      parts: [{ text: systemInstruction + " IMPORTANT: You are replying in a WhatsApp mobile chat context. Keep responses natural, engaging, and avoid overly long robotic essays unless explicitly requested." }]
    }
  };

  let delay = 1000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";
      }

      if (response.status === 429 || response.status >= 500) {
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
        continue;
      }

      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP error ${response.status}`);
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise(res => setTimeout(res, delay));
      delay *= 2;
    }
  }
  return "Sorry, connection failed.";
}

export default function App() {
  // Account State
  const [accounts, setAccounts] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem('wa_ai_accounts');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem('wa_ai_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Auth UI State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [usernameInput, setUsernameInput] = useState('');
  const [avatarInput, setAvatarInput] = useState('🧑‍💻');
  const [authError, setAuthError] = useState('');

  // App Theme State
  const [darkMode, setDarkMode] = useState(true);

  // Chat Data State
  const [friends, setFriends] = useState<Friend[]>(DEFAULT_FRIENDS);
  const [activeFriendId, setActiveFriendId] = useState<string>(DEFAULT_FRIENDS[0].id);
  const [chats, setChats] = useState<Record<string, Message[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  
  // Active Chat State
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  // Modals & Panels
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);

  // New Custom Friend State
  const [newFriend, setNewFriend] = useState({
    name: '',
    tagline: '',
    personality: '',
    greeting: 'Hey there! Nice to connect with you on WhatsApp! 👋',
    emoji: '🤖'
  });

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync Accounts & Active User
  useEffect(() => {
    localStorage.setItem('wa_ai_accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('wa_ai_current_user', JSON.stringify(currentUser));
      const userChatsKey = `wa_ai_chats_${currentUser.id}`;
      const userFriendsKey = `wa_ai_friends_${currentUser.id}`;
      
      const savedChats = localStorage.getItem(userChatsKey);
      const savedFriends = localStorage.getItem(userFriendsKey);

      if (savedFriends) {
        setFriends(JSON.parse(savedFriends));
      } else {
        setFriends(DEFAULT_FRIENDS);
      }

      if (savedChats) {
        setChats(JSON.parse(savedChats));
      } else {
        const initialChats: Record<string, Message[]> = {};
        DEFAULT_FRIENDS.forEach(f => {
          initialChats[f.id] = [{
            id: 'init-' + f.id,
            sender: 'friend',
            text: f.greeting,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'read'
          }];
        });
        setChats(initialChats);
      }
    } else {
      localStorage.removeItem('wa_ai_current_user');
    }
  }, [currentUser]);

  // Persist user chat updates
  useEffect(() => {
    if (currentUser && Object.keys(chats).length > 0) {
      localStorage.setItem(`wa_ai_chats_${currentUser.id}`, JSON.stringify(chats));
    }
  }, [chats, currentUser]);

  // Persist user custom friends
  useEffect(() => {
    if (currentUser && friends.length > 0) {
      localStorage.setItem(`wa_ai_friends_${currentUser.id}`, JSON.stringify(friends));
    }
  }, [friends, currentUser]);

  // Auto scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, activeFriendId, isTyping]);

  // Handle Account Authentication
  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const trimmed = usernameInput.trim();
    if (!trimmed) {
      setAuthError('Please enter a username');
      return;
    }

    if (authMode === 'register') {
      const existing = accounts.find(a => a.username.toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        setAuthError('Username already taken. Please choose another.');
        return;
      }
      const newUser: UserAccount = {
        id: 'usr_' + Date.now(),
        username: trimmed,
        avatar: avatarInput,
        joinedAt: new Date().toLocaleDateString()
      };
      setAccounts([...accounts, newUser]);
      setCurrentUser(newUser);
    } else {
      const existing = accounts.find(a => a.username.toLowerCase() === trimmed.toLowerCase());
      if (!existing) {
        setAuthError('Account not found. Switch to "Create Account".');
        return;
      }
      setCurrentUser(existing);
    }
    setUsernameInput('');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setChats({});
    setFriends(DEFAULT_FRIENDS);
  };

  // Currently active friend object
  const activeFriend = friends.find(f => f.id === activeFriendId) || friends[0];
  const activeMessages = (activeFriend && chats[activeFriend.id]) || [];

  // Image Upload handler
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        alert('Please choose an image under 4MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setSelectedImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Send Message Logic
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!inputText.trim() && !selectedImage) || isTyping) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: inputText.trim(),
      image: selectedImage,
      timestamp: timeStr,
      status: 'read'
    };

    const updatedHistory = [...activeMessages, userMsg];
    setChats(prev => ({
      ...prev,
      [activeFriend.id]: updatedHistory
    }));

    const currentImg = selectedImage;

    setInputText('');
    setSelectedImage(null);
    setIsTyping(true);

    try {
      const responseText = await callGeminiAPI(
        updatedHistory,
        activeFriend.personality,
        currentImg
      );

      const aiMsg: Message = {
        id: 'ai-' + Date.now(),
        sender: 'friend',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'read'
      };

      setChats(prev => ({
        ...prev,
        [activeFriend.id]: [...(prev[activeFriend.id] || []), aiMsg]
      }));
    } catch {
      const errorMsg: Message = {
        id: 'err-' + Date.now(),
        sender: 'friend',
        text: "⚠️ Oops! I had trouble connecting. Please check your Gemini API key or try again in a moment.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'read'
      };
      setChats(prev => ({
        ...prev,
        [activeFriend.id]: [...(prev[activeFriend.id] || []), errorMsg]
      }));
    } finally {
      setIsTyping(false);
    }
  };

  // Text to Speech
  const toggleSpeech = (text: string, msgId: string) => {
    if ('speechSynthesis' in window) {
      if (speakingMsgId === msgId) {
        window.speechSynthesis.cancel();
        setSpeakingMsgId(null);
      } else {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.onend = () => setSpeakingMsgId(null);
        utterance.onerror = () => setSpeakingMsgId(null);
        setSpeakingMsgId(msgId);
        window.speechSynthesis.speak(utterance);
      }
    } else {
      alert("Text-to-speech isn't supported in your browser.");
    }
  };

  // Create Custom Friend
  const handleCreateFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriend.name.trim() || !newFriend.personality.trim()) return;

    const created: Friend = {
      id: 'custom-' + Date.now(),
      name: newFriend.name.trim(),
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(newFriend.name)}`,
      emoji: newFriend.emoji || '🤖',
      status: 'online',
      tagline: newFriend.tagline || 'Custom AI Companion',
      personality: newFriend.personality,
      greeting: newFriend.greeting,
      themeColor: '#00a884'
    };

    setFriends(prev => [created, ...prev]);
    setChats(prev => ({
      ...prev,
      [created.id]: [{
        id: 'init-' + created.id,
        sender: 'friend',
        text: created.greeting,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'read'
      }]
    }));

    setActiveFriendId(created.id);
    setShowAddFriend(false);
    setNewFriend({
      name: '',
      tagline: '',
      personality: '',
      greeting: 'Hey there! Nice to connect with you on WhatsApp! 👋',
      emoji: '🤖'
    });
  };

  const filteredFriends = friends.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.tagline.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!currentUser) {
    return (
      <div className={`min-h-screen w-full flex items-center justify-center p-4 transition-colors duration-200 ${
        darkMode ? 'bg-[#0c1317] text-white' : 'bg-[#e1e9eb] text-slate-800'
      }`}>
        <div className={`w-full max-w-md rounded-2xl p-8 shadow-2xl border ${
          darkMode ? 'bg-[#111b21] border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#00a884] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#00a884]/20">
              <Bot className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">WhatsApp AI Friends</h1>
            <p className="text-xs text-emerald-500 font-medium mt-1">Powered by Gemini AI</p>
            <p className="text-sm text-slate-400 mt-2">
              Sign in to keep your personal chats separate & secure
            </p>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="e.g. Alex123"
                  className={`w-full pl-10 pr-4 py-3 text-sm rounded-xl outline-none border transition-all ${
                    darkMode
                      ? 'bg-[#202c33] border-slate-700 focus:border-[#00a884] text-white'
                      : 'bg-slate-50 border-slate-300 focus:border-[#00a884] text-slate-900'
                  }`}
                />
              </div>
            </div>

            {authMode === 'register' && (
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">Select Avatar Emoji</label>
                <div className="flex gap-2 justify-between">
                  {['🧑‍💻', '🌸', '⚡', '🎮', '☕', '🐱', '🚀'].map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setAvatarInput(e)}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-transform active:scale-95 ${
                        avatarInput === e
                          ? 'bg-[#00a884] text-white ring-2 ring-emerald-400'
                          : darkMode ? 'bg-[#202c33]' : 'bg-slate-100'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 px-4 bg-[#00a884] hover:bg-[#029071] text-white font-semibold rounded-xl shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <span>{authMode === 'login' ? 'Open WhatsApp Chats' : 'Create New Account'}</span>
              <Sparkles className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center pt-4 border-t border-slate-800/50">
            {authMode === 'login' ? (
              <p className="text-xs text-slate-400">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode('register'); setAuthError(''); }}
                  className="text-[#00a884] font-semibold hover:underline"
                >
                  Create Account
                </button>
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                Already created an account?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setAuthError(''); }}
                  className="text-[#00a884] font-semibold hover:underline"
                >
                  Log In
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen w-full overflow-hidden font-sans select-none ${
      darkMode ? 'bg-[#111b21] text-slate-100' : 'bg-[#f0f2f5] text-slate-800'
    }`}>

      {/* LEFT SIDEBAR */}
      <div className={`w-full md:w-[380px] lg:w-[420px] flex flex-col h-full shrink-0 border-r transition-all ${
        darkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-slate-200'
      }`}>

        <div className={`p-3 px-4 flex items-center justify-between border-b ${
          darkMode ? 'bg-[#202c33] border-[#222d34]' : 'bg-[#f0f2f5] border-slate-200'
        }`}>
          <div
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-full bg-[#00a884]/20 border border-[#00a884] flex items-center justify-center text-xl shadow-sm">
              {currentUser.avatar}
            </div>
            <div className="leading-tight">
              <h2 className="font-semibold text-sm group-hover:text-[#00a884] transition-colors">{currentUser.username}</h2>
              <span className="text-[11px] text-emerald-500 flex items-center gap-1">
                <Circle className="w-2 h-2 fill-emerald-500" /> Online
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-slate-400">
            <button
              onClick={() => setDarkMode(!darkMode)}
              title="Toggle Light/Dark Theme"
              className="p-2 hover:bg-slate-500/10 rounded-full transition-colors"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>
            <button
              onClick={() => setShowAddFriend(true)}
              title="Add Custom AI Friend"
              className="p-2 hover:bg-slate-500/10 rounded-full transition-colors text-[#00a884]"
            >
              <UserPlus className="w-5 h-5" />
            </button>
            <button
              onClick={handleLogout}
              title="Log Out"
              className="p-2 hover:bg-slate-500/10 rounded-full transition-colors text-red-400"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-2 px-3">
          <div className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm ${
            darkMode ? 'bg-[#202c33] text-slate-200' : 'bg-slate-100 text-slate-700'
          }`}>
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search or start new chat"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-xs py-1"
            />
            {searchQuery && (
              <X onClick={() => setSearchQuery('')} className="w-4 h-4 text-slate-400 cursor-pointer" />
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/20">
          {filteredFriends.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No AI friends found matching "{searchQuery}".
            </div>
          ) : (
            filteredFriends.map((friend) => {
              const friendMsgs = chats[friend.id] || [];
              const lastMsg = friendMsgs[friendMsgs.length - 1];
              const isActive = friend.id === activeFriendId;

              return (
                <div
                  key={friend.id}
                  onClick={() => setActiveFriendId(friend.id)}
                  className={`flex items-center gap-3 p-3 px-4 cursor-pointer transition-colors relative ${
                    isActive
                      ? darkMode ? 'bg-[#2a3942]' : 'bg-slate-200/70'
                      : darkMode ? 'hover:bg-[#202c33]' : 'hover:bg-slate-100'
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={friend.avatar}
                      alt={friend.name}
                      className="w-12 h-12 rounded-full object-cover border border-slate-700/50"
                    />
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#111b21] rounded-full" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className="text-sm font-semibold truncate flex items-center gap-1.5">
                        <span>{friend.name}</span>
                        <span className="text-xs">{friend.emoji}</span>
                      </h3>
                      {lastMsg && (
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {lastMsg.timestamp}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 truncate">
                      {lastMsg ? (
                        <span>
                          {lastMsg.sender === 'user' && 'You: '}
                          {lastMsg.text || '📷 Sent an image'}
                        </span>
                      ) : (
                        <span className="italic">{friend.tagline}</span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className={`p-2 px-4 border-t text-[11px] text-center text-slate-500 flex items-center justify-between ${
          darkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-slate-50 border-slate-200'
        }`}>
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-[#00a884]" /> Account: <strong className="text-slate-300">{currentUser.username}</strong>
          </span>
          <span className="text-slate-400">Gemini Active</span>
        </div>
      </div>

      {/* MAIN CHAT WINDOW */}
      <div className="flex-1 flex flex-col h-full bg-[#0b141a] relative overflow-hidden">

        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, #ffffff 1px, transparent 1px)`,
            backgroundSize: '20px 20px'
          }}
        />

        <div className={`p-3 px-4 flex items-center justify-between z-10 border-b shadow-sm ${
          darkMode ? 'bg-[#202c33] border-[#222d34]' : 'bg-[#f0f2f5] border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <img
              src={activeFriend.avatar}
              alt={activeFriend.name}
              className="w-10 h-10 rounded-full object-cover border border-slate-700/50"
            />
            <div>
              <h2 className="font-semibold text-sm flex items-center gap-1.5">
                <span>{activeFriend.name}</span>
                <span className="text-xs">{activeFriend.emoji}</span>
              </h2>
              <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                {isTyping ? (
                  <span className="animate-pulse font-medium">typing...</span>
                ) : (
                  <span>online • {activeFriend.tagline}</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <button
              onClick={() => setActiveCall({ friend: activeFriend, type: 'video', status: 'ringing' })}
              title="Start Video Call"
              className="p-2 hover:bg-slate-500/10 rounded-full transition-colors"
            >
              <Video className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveCall({ friend: activeFriend, type: 'audio', status: 'ringing' })}
              title="Start Audio Call"
              className="p-2 hover:bg-slate-500/10 rounded-full transition-colors"
            >
              <Phone className="w-5 h-5" />
            </button>
            <div className="h-4 w-[1px] bg-slate-700 mx-1" />
            <button
              onClick={() => {
                if (confirm(`Clear chat history with ${activeFriend.name}?`)) {
                  setChats(prev => ({
                    ...prev,
                    [activeFriend.id]: []
                  }));
                }
              }}
              title="Clear Chat"
              className="p-2 hover:bg-slate-500/10 rounded-full transition-colors text-red-400/80 hover:text-red-400"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 z-10">
          <div className="text-center my-2">
            <span className={`inline-block px-3 py-1.5 rounded-lg text-[11px] max-w-md ${
              darkMode ? 'bg-[#182229] text-amber-200/80 border border-amber-500/10' : 'bg-amber-50 text-amber-900 border border-amber-200'
            }`}>
              🔒 Messages are generated by Gemini AI with custom personality prompts. Safe & private to your account.
            </span>
          </div>

          {activeMessages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group`}
              >
                <div className={`relative max-w-[85%] md:max-w-[70%] rounded-2xl px-3.5 py-2 shadow-sm ${
                  isUser
                    ? 'bg-[#005c4b] text-white rounded-tr-none'
                    : darkMode
                      ? 'bg-[#202c33] text-slate-100 rounded-tl-none'
                      : 'bg-white text-slate-800 rounded-tl-none'
                }`}>
                  {msg.image && (
                    <div className="mb-2 rounded-lg overflow-hidden max-h-60">
                      <img src={msg.image} alt="Attachment" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="text-xs md:text-sm whitespace-pre-wrap leading-relaxed pr-10">
                    {msg.text}
                  </div>

                  <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px] text-slate-300/80">
                    {!isUser && (
                      <button
                        onClick={() => toggleSpeech(msg.text, msg.id)}
                        className="hover:text-emerald-400 transition-colors mr-1"
                        title="Read aloud"
                      >
                        {speakingMsgId === msg.id ? (
                          <VolumeX className="w-3 h-3 text-emerald-400 animate-pulse" />
                        ) : (
                          <Volume2 className="w-3 h-3 opacity-60 hover:opacity-100" />
                        )}
                      </button>
                    )}
                    <span>{msg.timestamp}</span>
                    {isUser && (
                      <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="flex items-start gap-2">
              <div className={`px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1.5 ${
                darkMode ? 'bg-[#202c33]' : 'bg-white'
              }`}>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {selectedImage && (
          <div className={`p-2 px-4 z-10 flex items-center justify-between border-t ${
            darkMode ? 'bg-[#182229] border-[#222d34]' : 'bg-slate-100 border-slate-300'
          }`}>
            <div className="flex items-center gap-3">
              <img src={selectedImage} alt="Preview" className="w-12 h-12 object-cover rounded-lg border border-emerald-500" />
              <span className="text-xs text-slate-300">Image attached for Gemini Vision</span>
            </div>
            <button
              onClick={() => setSelectedImage(null)}
              className="p-1 hover:bg-slate-700/50 rounded-full text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <form
          onSubmit={handleSendMessage}
          className={`p-3 px-4 z-10 flex items-center gap-2 border-t ${
            darkMode ? 'bg-[#202c33] border-[#222d34]' : 'bg-[#f0f2f5] border-slate-200'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach photo"
            className="p-2 text-slate-400 hover:text-emerald-400 rounded-full transition-colors"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <div className={`flex-1 flex items-center rounded-xl px-4 py-2 ${
            darkMode ? 'bg-[#2a3942] text-white' : 'bg-white text-slate-800'
          }`}>
            <input
              type="text"
              placeholder={`Message ${activeFriend.name}...`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-sm placeholder:text-slate-400"
            />
          </div>

          <button
            type="submit"
            disabled={(!inputText.trim() && !selectedImage) || isTyping}
            className={`p-3 rounded-full flex items-center justify-center transition-all ${
              (inputText.trim() || selectedImage) && !isTyping
                ? 'bg-[#00a884] text-white hover:bg-[#029071] shadow-md active:scale-95'
                : 'bg-slate-700/30 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* MODAL: ADD CUSTOM AI FRIEND */}
      {showAddFriend && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border ${
            darkMode ? 'bg-[#111b21] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-700/50">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#00a884]" /> Create AI Friend
              </h3>
              <button onClick={() => setShowAddFriend(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFriend} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Friend Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Professor Oliver"
                  value={newFriend.name}
                  onChange={(e) => setNewFriend({ ...newFriend, name: e.target.value })}
                  className={`w-full p-2.5 text-sm rounded-xl outline-none border ${
                    darkMode ? 'bg-[#202c33] border-slate-700 text-white' : 'bg-slate-50 border-slate-300'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Tagline / Role</label>
                <input
                  type="text"
                  placeholder="e.g. Wise history mentor & bookworm"
                  value={newFriend.tagline}
                  onChange={(e) => setNewFriend({ ...newFriend, tagline: e.target.value })}
                  className={`w-full p-2.5 text-sm rounded-xl outline-none border ${
                    darkMode ? 'bg-[#202c33] border-slate-700 text-white' : 'bg-slate-50 border-slate-300'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Personality System Prompt</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe how your friend should talk, their tone, hobbies, and vibe..."
                  value={newFriend.personality}
                  onChange={(e) => setNewFriend({ ...newFriend, personality: e.target.value })}
                  className={`w-full p-2.5 text-sm rounded-xl outline-none border ${
                    darkMode ? 'bg-[#202c33] border-slate-700 text-white' : 'bg-slate-50 border-slate-300'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Initial Greeting Message</label>
                <input
                  type="text"
                  value={newFriend.greeting}
                  onChange={(e) => setNewFriend({ ...newFriend, greeting: e.target.value })}
                  className={`w-full p-2.5 text-sm rounded-xl outline-none border ${
                    darkMode ? 'bg-[#202c33] border-slate-700 text-white' : 'bg-slate-50 border-slate-300'
                  }`}
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#00a884] hover:bg-[#029071] text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <span>Add Friend to WhatsApp</span>
                <Check className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SIMULATED VOICE / VIDEO CALL MODAL */}
      {activeCall && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-between p-8 text-white">
          <div className="text-center mt-8">
            <span className="text-xs uppercase tracking-widest text-emerald-400 font-semibold">
              WhatsApp {activeCall.type === 'video' ? 'Video' : 'Audio'} Call
            </span>
            <h2 className="text-2xl font-bold mt-2">{activeCall.friend.name}</h2>
            <p className="text-sm text-slate-400 mt-1 animate-pulse">Connected • Gemini Audio Simulation</p>
          </div>

          <div className="relative my-auto">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-emerald-500 overflow-hidden shadow-2xl relative">
              <img src={activeCall.friend.avatar} alt="Call Avatar" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -inset-3 rounded-full border-2 border-emerald-500/40 animate-ping pointer-events-none" />
          </div>

          <div className="flex items-center gap-6 mb-8">
            <button
              onClick={() => setActiveCall(null)}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
            >
              <PhoneOff className="w-8 h-8" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL: PROFILE & SETTINGS */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl border ${
            darkMode ? 'bg-[#111b21] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-700/50">
              <h3 className="font-bold text-lg">Your Profile</h3>
              <button onClick={() => setShowProfile(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center my-6">
              <div className="w-20 h-20 rounded-full bg-[#00a884]/20 border-2 border-[#00a884] flex items-center justify-center text-4xl mx-auto mb-3">
                {currentUser.avatar}
              </div>
              <h2 className="font-bold text-xl">{currentUser.username}</h2>
              <p className="text-xs text-slate-400 mt-1">Joined {currentUser.joinedAt}</p>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-800/50">
              <button
                onClick={() => { setShowProfile(false); handleLogout(); }}
                className="w-full py-2.5 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <LogOut className="w-4 h-4" /> Switch / Log Out Account
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
