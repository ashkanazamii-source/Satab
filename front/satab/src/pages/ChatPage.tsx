// src/pages/ChatPage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import api from '../services/api';
import {
    Box, Paper, Stack, Typography, IconButton, TextField, Button, Divider,
    List, ListItemButton, ListItemText, ListItemAvatar, Avatar, Badge, Chip,
    CircularProgress, Tooltip, InputAdornment, Dialog, DialogTitle, DialogContent,
    DialogActions
} from '@mui/material';
import { alpha, keyframes, useTheme } from '@mui/material/styles';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import DoneRoundedIcon from '@mui/icons-material/DoneRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';

const shimmer = keyframes`
  0% { background-position: 0% 50% }
  50% { background-position: 100% 50% }
  100% { background-position: 0% 50% }
`;
const fancyCard = (t: any) => ({
    border: '1px solid transparent',
    borderRadius: 14,
    background: `
    linear-gradient(${alpha(t.palette.background.paper, .9)}, ${alpha(t.palette.background.paper, .9)}) padding-box,
    linear-gradient(120deg, rgba(99,102,241,.45), rgba(236,72,153,.4), rgba(16,185,129,.4)) border-box
  `,
    backgroundSize: '200% 200%, 200% 200%',
    animation: `${shimmer} 10s ease infinite`,
    backdropFilter: 'blur(8px)',
});

type RoleLevel = 1 | 2 | 3 | 4 | 5 | 6;
type User = { id: number; full_name: string; role_level: RoleLevel };

type RoomTypeHttp = 'SA_GROUP' | 'DIRECT';
type Room = {
    id: number;
    type: RoomTypeHttp;        // از HTTP می‌آد (ممکنه SA_GROUP باشد)
    title?: string | null;
    sa_root_user_id?: number | null;
    direct_key?: string | null; // برای DM: "minId-maxId"
    max_upload_mb?: number | null;
};

type MessageKind = 'TEXT' | 'IMAGE' | 'FILE';
type Message = {
    id: number;
    room_id: number;
    sender_id: number;
    senderName: string; // اضافه شد
    kind: MessageKind;
    text?: string | null;
    attachment_url?: string | null;
    attachment_mime?: string | null;
    attachment_size?: number | null;
    created_at: string;
};

function useLocalToken() { return localStorage.getItem('token') ?? ''; }

/* ==========================
   Chat (ساده و بدون شرط)
========================== */
export default function ChatPage() {
    const [me, setMe] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        (async () => {
            setLoading(true);
            try { const { data } = await api.get('/auth/me'); setMe(data); }
            catch { setMe(null); }
            finally { setLoading(false); }
        })();
    }, []);
    if (loading) {
        return <Box sx={{ height: '65vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
    }
    if (!me) return <Box p={2}><Typography color="error">مشکل در دریافت اطلاعات کاربر</Typography></Box>;
    return <ChatApp me={me} />;
}

function ChatApp({ me }: { me: User }) {
    const theme = useTheme();

    // ===== WS & refs
    const tokenRaw = useLocalToken();
    const token = useMemo(() => (tokenRaw || '').replace(/^Bearer\s+/i, ''), [tokenRaw]);
    const socketRef = useRef<Socket | null>(null);

    const listRef = useRef<HTMLDivElement | null>(null);
    const activeRoomIdRef = useRef<number | null>(null);
    const activeRoomRef = useRef<Room | null>(null);
    const lastWireRoomRef = useRef<{ kind: 'DIRECT' | 'GROUP'; peerId?: number; groupId?: number } | null>(null);

    // ===== State
    const [rooms, setRooms] = useState<Room[]>([]);
    const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
    const activeRoom = useMemo(() => rooms.find(r => r.id === activeRoomId) || null, [rooms, activeRoomId]);

    const [messages, setMessages] = useState<Message[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const [fetchingMsgs, setFetchingMsgs] = useState(false);

    const [presence, setPresence] = useState<number[]>([]);
    const [typingUsers, setTypingUsers] = useState<number[]>([]);
    const [searchQ, setSearchQ] = useState('');
    const [visibleUsers, setVisibleUsers] = useState<User[]>([]);
    const [openNewDm, setOpenNewDm] = useState(false);
    const [dmUser, setDmUser] = useState<User | null>(null);
    const messagesRef = useRef<Message[]>([]);
    useEffect(() => { messagesRef.current = messages; }, [messages]);
    const [input, setInput] = useState('');
    const [file, setFile] = useState<File | null>(null);

    const [readsByMsg, setReadsByMsg] = useState<Record<number, Record<number, true>>>({});
    const isReadByOtherThanSender = useCallback((m: Message) => {
        const readers = readsByMsg[m.id]; if (!readers) return false;
        return Object.keys(readers).map(Number).some(id => id !== m.sender_id);
    }, [readsByMsg]);

    const [defaultMaxBytes, setDefaultMaxBytes] = useState(10 * 1024 * 1024);
    const [roomMaxBytes, setRoomMaxBytes] = useState<Record<number, number>>({});
    const uploadLimitBytes = activeRoom ? (roomMaxBytes[activeRoom.id] ?? defaultMaxBytes) : defaultMaxBytes;

    useEffect(() => { activeRoomIdRef.current = activeRoomId; }, [activeRoomId]);
    useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);

    // ===== Utils
    const dmRoomName = (a: number, b: number) => {
        const [x, y] = a < b ? [a, b] : [b, a];
        return `DM:${x}:${y}`;
    };
    const grpRoomName = (id: number) => `GRP:${id}`;
    const dmPeerId = useCallback((room: Room | null, myId: number): number | null => {
        if (!room || room.type !== 'DIRECT' || !room.direct_key) return null;
        const [a, b] = room.direct_key.split('-').map(Number);
        return a === myId ? b : a;
    }, []);
    const toWireRoom = useCallback((room: Room, myId: number) => {
        if (room.type === 'DIRECT') {
            const peer = dmPeerId(room, myId)!;
            return { kind: 'DIRECT' as const, peerId: peer };
        }
        return { kind: 'GROUP' as const, groupId: room.id }; // SA_GROUP ⇒ GROUP برای WS
    }, [dmPeerId]);

    const roomTitle = useCallback((room: Room) => {
        if (room.type === 'DIRECT') {
            const peer = dmPeerId(room, me.id);
            const u = visibleUsers.find(x => x.id === peer);
            return u ? u.full_name : `خصوصی #${peer}`;
        }
        return room.title || `گروه #${room.id}`;
    }, [dmPeerId, me.id, visibleUsers]);
    // جایگزین کن
    const byOldestFirst = (a: Message, b: Message) => {
        const ta = new Date(a.created_at).getTime();
        const tb = new Date(b.created_at).getTime();
        if (ta !== tb) return ta - tb;   // older first
        return a.id - b.id;              // tie-breaker
    };

    // نزدیکِ پایین؟
    const isNearBottom = () => {
        const el = listRef.current; if (!el) return true;
        return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };

    // ببر پایین
    const scrollToBottom = () => {
        const el = listRef.current; if (!el) return;
        el.scrollTop = el.scrollHeight;
    };



    // ===== HTTP: rooms / messages / users
    const loadRooms = useCallback(async () => {
        const { data } = await api.get('/chat/rooms');
        const rs: Room[] = Array.isArray(data) ? data : [];
        setRooms(rs);
        // max bytes
        setRoomMaxBytes(prev => {
            const next = { ...prev };
            for (const r of rs) if (typeof r.max_upload_mb === 'number') next[r.id] = r.max_upload_mb * 1024 * 1024;
            return next;
        });
        if (!activeRoomId && rs.length) setActiveRoomId(rs[0].id);
        // DM نام طرف را داشته باشیم
        ensurePeerUsersInCache(rs);
    }, [activeRoomId]);

    const fetchMessages = useCallback(async (roomId: number, reset = true) => {
        setFetchingMsgs(true);
        try {
            const curr = messagesRef.current;
            const beforeId = !reset && curr.length ? curr[0].id : undefined;

            const { data } = await api.get(`/chat/rooms/${roomId}/messages`, {
                params: { limit: 50, beforeId }
            });
            console.log('[FE] loadMessages API response (برای بررسی kind)', data); // <-- این خط رو اضافه کن

            const arr: Message[] = Array.isArray(data) ? data : [];
            arr.sort(byOldestFirst); // کلاسیک: قدیمی بالا، جدید پایین

            setMessages(prev => (reset ? arr : [...arr, ...prev])); // ⬅️ prepend
            setHasMore(arr.length >= 50);

            setReadsByMsg(prev => {
                const next = { ...prev };
                for (const m of arr) if (!next[m.id]) next[m.id] = {};
                return next;
            });

            for (const m of arr) if (m.sender_id !== me.id) safeEmitRead(m.id);

            if (reset) requestAnimationFrame(scrollToBottom);
        } finally {
            setFetchingMsgs(false);
        }
    }, [me.id]);


    const loadVisibleUsers = useCallback(async () => {
        try {
            const { data } = await api.get('/chat/visible-users');
            setVisibleUsers(Array.isArray(data) ? data : []);
        } catch { setVisibleUsers([]); }
    }, []);

    const ensurePeerUsersInCache = useCallback(async (rs: Room[]) => {
        const known = new Set<number>(visibleUsers.map(u => u.id));
        const need = new Set<number>();
        rs.forEach(r => {
            if (r.type === 'DIRECT' && r.direct_key) {
                const [a, b] = r.direct_key.split('-').map(Number);
                const pid = a === me.id ? b : a;
                if (pid && !known.has(pid)) need.add(pid);
            }
        });
        if (!need.size) return;
        // bulk (اگر بود)
        let users: User[] | null = null;
        try {
            const res = await api.get('/users/by-ids', { params: { ids: Array.from(need).join(',') } });
            users = Array.isArray(res?.data) ? res.data : null;
        } catch (e: any) {
            if (e?.response?.status !== 404) throw e;
        }
        // fallback تکی
        if (!users) {
            const results = await Promise.all(Array.from(need).map(async (id) => {
                try { const r = await api.get(`/users/${id}`); return r?.data as User; } catch { return null; }
            }));
            users = results.filter(Boolean) as User[];
        }
        if (users?.length) {
            setVisibleUsers(prev => {
                const map = new Map(prev.map(u => [u.id, u]));
                users!.forEach(u => map.set(u.id, u));
                return Array.from(map.values());
            });
        }
    }, [visibleUsers, me.id]);
    // جدیدترها اول (بالا)
    const byNewestFirst = (a: Message, b: Message) => {
        const ta = new Date(a.created_at).getTime();
        const tb = new Date(b.created_at).getTime();
        if (tb !== ta) return tb - ta; // newer first
        return b.id - a.id;            // tie-breaker
    };

    const absolutize = (url?: string | null) => {
        if (!url) return null;
        try {
            const base = api.defaults.baseURL || window.location.origin;
            return new URL(url, base).href;
        } catch {
            return url;
        }
    };

    // ===== WS connect
    useEffect(() => {
        const WS_URL =
            import.meta.env.VITE_WS_URL ||
            (api.defaults.baseURL ? new URL(api.defaults.baseURL).origin : window.location.origin);

        console.log('[FE] WS_URL', WS_URL, 'token.len=', token?.length);

        // از ساخت مجدد جلوگیری کن
        if (socketRef.current) return;

        const s = io(WS_URL, {
            path: '/ws',
            //transports: ['websocket'],
            withCredentials: true,
            auth: { token }, // token از localStorage همونه
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 500,
            reconnectionDelayMax: 5000,
        });

        socketRef.current = s;
        s.on('connect_error', (err: any) => {
            console.error('[FE] CONNECT_ERR', {
                message: err?.message,
                description: err?.description,
                context: err,
            });
        });
        // اتصال
        s.on('connect', () => {
            console.log('[FE] CONNECTED', s.id);
            if (activeRoomRef.current) {
                console.log('[FE] JOIN_ON_CONNECT');
                joinRoomWs(activeRoomRef.current);
            }
        });

        s.on('connect_error', (err) => console.error('[FE] CONNECT_ERR', err?.message || err));

        // پیام جدید از WS
        s.on('message:new', (m: any) => {
            try {
                const ar = activeRoomRef.current;
                if (!ar) return;

                // --- نرمال‌سازی فیلدها (WS = camelCase, HTTP = snake_case) ---
                const attUrl = m.attachment_url ?? m.attachmentUrl ?? null;
                const attMime = m.attachment_mime ?? m.attachmentMime ?? null;
                const attSize = m.attachment_size ?? m.attachmentSize ?? null;
                const created = m.created_at ?? m.createdAt ?? new Date().toISOString();
                const kind: MessageKind =
                    m.kind ? m.kind
                        : (attUrl ? 'IMAGE' : 'TEXT');

                const senderId = Number(m?.senderId ?? m?.sender_id);
                const roomKind = m?.room?.kind as 'GROUP' | 'DIRECT' | undefined;
                const groupId = Number(m?.room?.groupId ?? m?.room_id ?? NaN);
                const peerId = roomKind === 'DIRECT' ? Number(m?.room?.peerId ?? NaN) : null;

                // --- فیلتر تعلق پیام به اتاق فعال (مثل قبل) ---
                let belongs = true;
                if (roomKind === 'GROUP') {
                    belongs = groupId === ar.id;
                } else if (roomKind === 'DIRECT') {
                    const a = senderId;
                    const b = peerId!;
                    const pairEvent = [Math.min(a, b), Math.max(a, b)].join('-');
                    const pairActive = (ar.direct_key || '').trim();
                    belongs = pairEvent === pairActive;
                }
                if (!belongs) return;

                // --- ساخت آبجکت Message سازگار با state ---
                const msg: Message = {
                    id: Number(m.id),
                    room_id: ar.id,
                    sender_id: senderId,
                    senderName: m.senderName || `کاربر #${senderId}`,
                    kind,
                    text: (m.text ?? '') || null,
                    attachment_url: attUrl,
                    attachment_mime: attMime,
                    attachment_size: attSize,
                    created_at: typeof created === 'string'
                        ? new Date(created).toISOString()
                        : (created instanceof Date ? created.toISOString() : new Date().toISOString()),
                };

                setMessages(prev => {
                    if (prev.some(x => x.id === msg.id)) return prev;
                    const next = [...prev, msg];
                    next.sort(byOldestFirst);
                    return next;
                });

                if (msg.sender_id !== me.id) safeEmitRead(msg.id);
                if (isNearBottom()) requestAnimationFrame(scrollToBottom);

                setReadsByMsg(prev => prev[msg.id] ? prev : ({ ...prev, [msg.id]: {} }));
            } catch (err) {
                console.error('[FE] message:new HANDLER_ERROR', err, { incoming: m, activeRoom: activeRoomRef.current });
            }
        });


        // رسید خواندن
        s.on('message:read', (evt: any) => {
            const messageId = Number(evt?.messageId);
            const readerId = Number(evt?.readerId);
            if (!messageId || !readerId) return;
            setReadsByMsg(prev => {
                const prevReaders = prev[messageId] || {};
                if (prevReaders[readerId]) return prev;
                return { ...prev, [messageId]: { ...prevReaders, [readerId]: true } };
            });
        });

        // حضور
        s.on('presence.join', (p: { userId: number; room: string }) => {
            const ar = activeRoomRef.current; if (!ar) return;
            const ok = (ar.type === 'DIRECT'
                ? p.room === dmRoomName(Math.min(me.id, dmPeerId(ar, me.id) || 0), Math.max(me.id, dmPeerId(ar, me.id) || 0))
                : p.room === `GRP:${ar.id}`);
            if (ok) setPresence(prev => (prev.includes(p.userId) ? prev : [...prev, p.userId]));
        });

        s.on('presence.leave', (p: { userId: number; room: string }) => {
            const ar = activeRoomRef.current; if (!ar) return;
            const ok = (ar.type === 'DIRECT'
                ? p.room === dmRoomName(Math.min(me.id, dmPeerId(ar, me.id) || 0), Math.max(me.id, dmPeerId(ar, me.id) || 0))
                : p.room === `GRP:${ar.id}`);
            if (ok) setPresence(prev => prev.filter(id => id !== p.userId));
        });

        // تایپینگ
        s.on('typing.started', (p: { userId: number; room: string }) => {
            if (p.userId === me.id) return;
            const ar = activeRoomRef.current; if (!ar) return;
            const ok = (ar.type === 'DIRECT'
                ? p.room === dmRoomName(Math.min(me.id, dmPeerId(ar, me.id) || 0), Math.max(me.id, dmPeerId(ar, me.id) || 0))
                : p.room === `GRP:${ar.id}`);
            if (ok) setTypingUsers(prev => (prev.includes(p.userId) ? prev : [...prev, p.userId]));
        });

        s.on('typing.stopped', (p: { userId: number; room: string }) => {
            setTypingUsers(prev => prev.filter(id => id !== p.userId));
        });

        // آپلود‌لیمیت (اختیاری)
        s.on('config.upload_limit_updated', (p: { defaultMaxBytes?: number; roomId?: number; maxBytes?: number }) => {
            if (p.defaultMaxBytes != null) setDefaultMaxBytes(p.defaultMaxBytes);
            if (p.roomId && p.maxBytes != null) setRoomMaxBytes(prev => ({ ...prev, [p.roomId!]: p.maxBytes! }));
        });

        // Clean up
        return () => {
            s.removeAllListeners();
            s.disconnect();
            socketRef.current = null;
        };

        // ⛔️ فقط یک بار اجرا شود
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    // ===== Join/leave room over WS + presence list
    const joinRoomWs = useCallback(async (room: Room | null) => {
        const s = socketRef.current; if (!s || !room) return;

        // leave prev
        if (lastWireRoomRef.current) {
            try { await s.timeout(3000).emitWithAck('room.leave', lastWireRoomRef.current); } catch { }
        }

        const wire = toWireRoom(room, me.id);
        lastWireRoomRef.current = wire;

        try { await s.timeout(3000).emitWithAck('room.join', wire); } catch { }

        // presence.list
        try {
            const { users } = await s.timeout(3000).emitWithAck('presence.list', wire);
            setPresence(Array.isArray(users) ? users : []);
        } catch { setPresence([]); }

        // reset typing
        setTypingUsers([]);
    }, [toWireRoom, me.id]);

    // ===== Readers
    const sentReadsRef = useRef<Set<number>>(new Set());
    const safeEmitRead = (messageId: number) => {
        const s = socketRef.current; const ar = activeRoomRef.current;
        if (!s || !ar || sentReadsRef.current.has(messageId)) return;
        const wire = toWireRoom(ar, me.id);
        sentReadsRef.current.add(messageId);
        s.emit('chat.message.read', { ...wire, messageId });
    };

    // ===== Send


    // ===== Start DM
    const startDirect = useCallback(async (userId: number) => {
        try {
            const { data } = await api.post(`/chat/direct/${userId}`, { text: '' });
            const rid = data?.room_id ?? data?.room?.id ?? null;
            await loadRooms();
            if (rid) setActiveRoomId(rid);
            setOpenNewDm(false); setDmUser(null);
        } catch (e: any) {
            alert(e?.response?.data?.message || 'ایجاد گفتگوی خصوصی ناموفق بود.');
        }
    }, [loadRooms]);

    // ===== lifecycle
    useEffect(() => { (async () => { await loadVisibleUsers(); await loadRooms(); })(); }, [loadRooms, loadVisibleUsers]);
    useEffect(() => {
        if (!activeRoomId) return;
        fetchMessages(activeRoomId, true);
        const r = rooms.find(x => x.id === activeRoomId) || null;
        joinRoomWs(r);
    }, [activeRoomId, rooms, fetchMessages, joinRoomWs]);


    useEffect(() => {
        if (isNearBottom()) requestAnimationFrame(scrollToBottom);
    }, [messages.length]);


    // ===== UI
    const [readersOpen, setReadersOpen] = useState(false);
    const [readersForMsgId, setReadersForMsgId] = useState<number | null>(null);
    const [readers, setReaders] = useState<{ id: number; full_name?: string; read_at: string }[]>([]);
    const openReaders = useCallback(async (id: number) => {
        setReadersForMsgId(id); setReadersOpen(true);
        try { const { data } = await api.get(`/chat/messages/${id}/readers`); setReaders(Array.isArray(data) ? data : []); }
        catch (e: any) { setReaders([]); alert(e?.response?.data?.message || 'خطا در خواندن لیست خوانندگان.'); }
    }, []);

    const presenceCountFor = (r: Room) => {
        if (r.type === 'DIRECT') {
            // در DM تعداد حاضرین غیر از خودت را نشان بده
            return presence.includes(me.id) ? presence.filter(id => id !== me.id).length : presence.length;
        }
        return presence.length;
    };
    // ===== typing (WS) — این بخش را بالای return بگذار
    const typingTimerRef = useRef<number | null>(null);

    const handleTyping = useCallback((val: string) => {
        setInput(val);

        const s = socketRef.current;
        const ar = activeRoomRef.current;
        if (!s || !ar) return;

        // تراتل ۱.۲ ثانیه‌ای
        if (typingTimerRef.current) {
            window.clearTimeout(typingTimerRef.current);
            typingTimerRef.current = null;
        }

        const wire = toWireRoom(ar, me.id);
        s.emit('typing.start', wire);

        typingTimerRef.current = window.setTimeout(() => {
            s.emit('typing.stop', wire);
            typingTimerRef.current = null;
        }, 1200);
    }, [toWireRoom, me.id]);
    // در داخل ChatApp، جایگزین کنید:
    const handleSend = useCallback(async () => {
        const s = socketRef.current;
        if (!activeRoom || !s) return;

        // تا وقتی واقعاً وصل نشده، چیزی نفرست
        if (!s.connected) {
            console.warn('[FE] socket not connected yet, waiting…');
            await new Promise<void>((resolve) => s.once('connect', () => resolve()));
        }

        const text = input.trim();
        const hasText = !!text;
        const hasFile = !!file;
        if (!hasText && !hasFile) return;

        // === بررسی‌های اولیه فایل ===
        if (hasFile) {
            // 1. نوع فایل
            if (!file!.type.startsWith('image/')) {
                alert('فقط فایل‌های تصویری مجاز هستند.');
                return; // متوقف کردن ارسال
            }

            // 2. حجم فایل (مثال: 10MB = 10 * 1024 * 1024 bytes)
            // فرض: uploadLimitBytes از Context یا State گرفته می‌شود
            if (file!.size > uploadLimitBytes) {
                alert(`حجم فایل بیش از حد مجاز (${Math.floor(uploadLimitBytes / 1024 / 1024)}MB) است.`);
                return; // متوقف کردن ارسال
            }
        }
        // === پایان بررسی‌های اولیه ===

        const wire = toWireRoom(activeRoom, me.id);
        let messageSent = false; // پرچم برای ردیابی موفقیت ارسال
        try {
            if (hasFile) {
                const form = new FormData();
                form.append('file', file!);
                console.log('[FE] SENDING_FILE', { fileName: file!.name, fileSize: file!.size, fileType: file!.type });
                const { data: savedImg } = await api.post(`/chat/rooms/${activeRoom.id}/messages/image`, form);
                console.log('[FE] FILE_SENT_RESPONSE', savedImg);
                if (savedImg?.id) {
                    const processedMessage: Message = {
                        id: savedImg.id,
                        room_id: savedImg.room_id ?? activeRoom.id,
                        sender_id: savedImg.sender_id ?? me.id,
                        senderName: savedImg.senderName ?? me.full_name ?? `کاربر #${me.id}`,
                        kind: savedImg.kind ?? 'IMAGE',
                        text: (savedImg.text && savedImg.text.trim() !== '') ? savedImg.text : null,
                        attachment_url: absolutize(savedImg.attachment_url ?? savedImg.attachmentUrl ?? null),
                        attachment_mime: savedImg.attachment_mime ?? savedImg.attachmentMime ?? null,
                        attachment_size: savedImg.attachment_size ?? savedImg.attachmentSize ?? null,
                        created_at: (savedImg.created_at ?? savedImg.createdAt) || new Date().toISOString(),
                    };

                    // ===================

                    setMessages(prev => {
                        const exists = prev.some(m => m.id === processedMessage.id);
                        if (exists) {
                            console.log('[FE] FILE_SENT IGNORED (duplicate id)', processedMessage.id);
                            // ممکن است بخواهید پیام را آپدیت کنید به جای رد کردن - اما برای سادگی فعلاً رد می‌کنیم
                            // یا می‌توانید آپدیت کنید:
                            // return prev.map(m => m.id === processedMessage.id ? processedMessage : m);
                            return prev;
                        }
                        const next = [...prev, processedMessage];
                        next.sort(byOldestFirst);
                        console.log('[FE] FILE_SENT ADDED TO STATE', processedMessage.id);
                        return next;
                    });
                    if (isNearBottom()) requestAnimationFrame(scrollToBottom);
                    messageSent = true; // ارسال فایل موفق بود
                }
            }


            if (hasText) {
                console.log('[FE] SEND_MSG', { wire, text, sid: s.id });
                const ack = await s.timeout(5000).emitWithAck('chat.message.send', { ...wire, text });
                console.log('[FE] SEND_ACK', ack);
                messageSent = true; // ارسال متن موفق بود
            }

            // فقط در صورت موفقیت در ارسال یکی از دو (یا هر دو)، ورودی‌ها را پاک کن
            if (messageSent) {
                setInput('');
                setFile(null);
            } else {
                // اگر هیچ چیزی ارسال نشد (مثلاً فایل انتخاب شد اما API آن را رد کرد)
                console.warn('[FE] No message was successfully sent.');
                // ممکن است بخواهید پیامی به کاربر نمایش دهید
            }

        } catch (e: any) {
            console.error('[FE] send failed:', e);
            // پیام خطا را به کاربر نمایش بده
            const errorMessage = e?.response?.data?.message || 'ارسال پیام ناموفق بود.';
            alert(errorMessage);
            // ورودی‌ها پاک نمی‌شوند تا کاربر بتواند دوباره تلاش کند
            // مگر اینکه خطا مربوط به متن باشد و فایل ارسال شده باشد
            // در آن صورت ممکن است بخواهید فقط `setInput('')` را فراخوانی کنید
        }
    }, [activeRoom, input, file, me.id, toWireRoom, uploadLimitBytes]); // اضافه کردن uploadLimitBytes به dependency array

    return (
        <Box sx={{ p: 2, height: 'calc(100vh - 64px)' }}>
            <Stack direction="row" spacing={2} sx={{ height: '100%' }}>
                {/* Sidebar */}
                <Paper elevation={0} sx={(t) => ({ ...fancyCard(t), width: 320, p: 1.25, display: 'flex', flexDirection: 'column' })}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: .5, pb: .5 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography fontWeight={800}>گفتگوها</Typography>
                        </Stack>
                        <Tooltip title="شروع گفتگوی خصوصی">
                            <IconButton size="small" onClick={() => setOpenNewDm(true)}><AddRoundedIcon fontSize="small" /></IconButton>
                        </Tooltip>
                    </Stack>

                    <TextField
                        size="small"
                        placeholder="جستجو..."
                        value={searchQ}
                        onChange={(e) => setSearchQ(e.target.value)}
                        InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }}
                        sx={{ m: .5 }}
                    />

                    <Divider sx={{ my: 1 }} />

                    <Box sx={{ overflowY: 'auto', flex: 1, pr: .5 }}>
                        <List dense>
                            {rooms
                                .filter(r => (roomTitle(r) || '').includes(searchQ))
                                .map(r => {
                                    const selected = r.id === activeRoomId;
                                    const isGroup = r.type !== 'DIRECT';
                                    return (
                                        <ListItemButton
                                            key={r.id}
                                            selected={selected}
                                            onClick={() => setActiveRoomId(r.id)}
                                            sx={(t) => ({
                                                borderRadius: 2, mb: .5,
                                                border: selected ? `1px solid ${alpha(t.palette.primary.main, .4)}` : '1px solid transparent',
                                            })}
                                        >
                                            <ListItemAvatar>
                                                <Badge color="success" badgeContent={presenceCountFor(r) || 0} invisible={presenceCountFor(r) === 0}>
                                                    <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, .25) }}>
                                                        {isGroup ? <GroupsRoundedIcon /> : <PersonRoundedIcon />}
                                                    </Avatar>
                                                </Badge>
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={<Typography fontWeight={700} noWrap>{roomTitle(r)}</Typography>}
                                                secondary={isGroup ? 'گروه' : 'خصوصی'}
                                            />
                                        </ListItemButton>
                                    );
                                })}
                        </List>
                    </Box>
                </Paper>

                {/* Main */}
                <Paper elevation={0} sx={(t) => ({ ...fancyCard(t), flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' })}>
                    {/* Header */}
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 1.25 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                            {activeRoom?.type === 'DIRECT' ? <PersonRoundedIcon /> : <GroupsRoundedIcon />}
                            <Typography fontWeight={900}>{activeRoom ? roomTitle(activeRoom) : '—'}</Typography>
                            {activeRoom && (<Chip size="small" label={activeRoom.type === 'DIRECT' ? 'خصوصی' : 'گروهی'} />)}
                        </Stack>
                        <Tooltip title={`حداکثر آپلود: ${Math.floor(uploadLimitBytes / 1024 / 1024)}MB`}>
                            <InfoOutlinedIcon sx={{ opacity: .7 }} />
                        </Tooltip>
                    </Stack>
                    <Divider />

                    {/* Messages */}
                    <Box ref={listRef} sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                        {fetchingMsgs && !messages.length ? (
                            <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}><CircularProgress size={24} /></Box>
                        ) : (
                            <Stack spacing={1}>
                                {/* Messages */}
                                <Box ref={listRef} sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                                    {fetchingMsgs && !messages.length ? (
                                        <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}><CircularProgress size={24} /></Box>
                                    ) : (
                                        <Stack spacing={1}>
                                            {messages.map(m => {
                                                const mine = m.sender_id === me.id;
                                                const isFile = !!m.attachment_url || m.kind !== 'TEXT';
                                                console.log('[FE] RENDER_MSG_DEBUG', { id: m.id, isFile, kind: m.kind, attachment_url: m.attachment_url, text: m.text }); // <-- لاگ اضافی
                                                return (
                                                    <Box key={m.id} sx={{ display: 'flex', justifyContent: mine ? 'flex-start' : 'flex-end' }}>
                                                        <Paper
                                                            elevation={0}
                                                            sx={(t) => ({
                                                                maxWidth: '72%',
                                                                p: 1,
                                                                borderRadius: mine ? '12px 12px 12px 4px' : '12px 12px 4px 12px',
                                                                bgcolor: mine ? alpha(t.palette.primary.main, .10) : alpha(t.palette.text.primary, .06),
                                                                border: '1px solid',
                                                                borderColor: mine ? alpha(t.palette.primary.main, .35) : 'divider',
                                                            })}
                                                        >
                                                            <Stack spacing={.5}>
                                                                {/* نمایش نام فرستنده - فقط برای پیام‌های دیگران */}
                                                                {!mine && (
                                                                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                                                                        {m.senderName || `کاربر #${m.sender_id}`}
                                                                    </Typography>
                                                                )}
                                                                {/* بخش render پیام‌ها - داخل Stack */}
                                                                {isFile ? (
                                                                    <>
                                                                        {/* بررسی نمایش عکس */}
                                                                        {(m.kind === 'IMAGE' || (m.attachment_mime && m.attachment_mime.startsWith('image/'))) ? (
                                                                            <Box sx={{ my: 0.5 }}>
                                                                                <img src={absolutize(m.attachment_url)!} alt="" style={{ maxWidth: 280, borderRadius: 8 }} />
                                                                            </Box>
                                                                        ) : (
                                                                            <a href={absolutize(m.attachment_url)!} target="_blank" rel="noreferrer">دانلود فایل</a>
                                                                        )}

                                                                        {/* فقط وقتی متن داره و خالی نیست نمایش بده */}
                                                                        {m.text && m.text.trim() !== '' && (
                                                                            <Typography sx={{ whiteSpace: 'pre-wrap' }}>{m.text}</Typography>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>{m.text}</Typography>
                                                                )}
                                                                <Stack direction="row" alignItems="center" spacing={0.75} justifyContent="flex-end">
                                                                    <Typography variant="caption" color="text.secondary" dir="ltr">
                                                                        {new Date(m.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                                                                    </Typography>

                                                                    {/* تیک‌ها برای همهٔ پیام‌ها (خوانده‌شدن توسط غیرِ فرستنده) */}
                                                                    {isReadByOtherThanSender(m)
                                                                        ? <DoneAllRoundedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                                                                        : <DoneRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />}

                                                                    <IconButton size="small" onClick={() => openReaders(m.id)} title="چه کسانی خوانده‌اند؟">
                                                                        <InfoOutlinedIcon fontSize="inherit" />
                                                                    </IconButton>
                                                                </Stack>
                                                            </Stack>
                                                        </Paper>
                                                    </Box>
                                                );
                                            })}
                                        </Stack>
                                    )}
                                </Box>
                            </Stack>
                        )}
                    </Box>

                    {/* typing */}
                    {!!typingUsers.length && (
                        <Box sx={{ px: 2, pb: .5, color: 'text.secondary' }}>
                            {typingUsers.length === 1 ? 'در حال تایپ...' : `${typingUsers.length} نفر در حال تایپ...`}
                        </Box>
                    )}

                    {/* input */}
                    <Divider />
                    <Stack direction="row" spacing={1} sx={{ p: 1.25 }}>
                        <input
                            id="chat-file"
                            type="file"
                            hidden
                            accept="image/*"
                            onChange={(e) => {
                                const f = e.target.files?.[0] || null;
                                if (f && !f.type?.startsWith('image/')) {
                                    alert('فقط تصویر مجاز است.');
                                    e.currentTarget.value = '';
                                    setFile(null);
                                    return;
                                }
                                if (f && activeRoom && f.size > uploadLimitBytes) {
                                    alert(`حجم تصویر بیش از حد مجاز (${Math.floor(uploadLimitBytes / 1024 / 1024)}MB) است.`);
                                    e.currentTarget.value = '';
                                    setFile(null);
                                    return;
                                }
                                setFile(f);
                            }}
                        />
                        <label htmlFor="chat-file">
                            <Tooltip title={`ضمیمه (حداکثر ${Math.floor(uploadLimitBytes / 1024 / 1024)}MB)`}>
                                <IconButton component="span"><AttachFileRoundedIcon /></IconButton>
                            </Tooltip>
                        </label>
                        <TextField
                            fullWidth size="small" placeholder="بنویسید..."
                            value={input}
                            onChange={(e) => handleTyping(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                            }}
                        />
                        <Button
                            variant="contained"
                            endIcon={<SendRoundedIcon />}
                            onClick={handleSend}

                        >
                            ارسال
                        </Button>
                    </Stack>
                    {file && (
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, pb: 1 }}>
                            <Chip label={`${file.name} — ${(file.size / 1024 / 1024).toFixed(1)}MB`} onDelete={() => setFile(null)} deleteIcon={<CloseRoundedIcon />} />
                        </Stack>
                    )}
                </Paper>
            </Stack>
            disabled={!activeRoom || (!input.trim() && !file) || !socketRef.current?.connected}

            {/* دیالوگ DM */}
            <Dialog open={openNewDm} onClose={() => setOpenNewDm(false)} maxWidth="xs" fullWidth>
                <DialogTitle>شروع گفتگوی خصوصی</DialogTitle>
                <DialogContent dividers>
                    <TextField
                        select
                        SelectProps={{ native: true }}
                        fullWidth size="small" label="انتخاب کاربر"
                        value={dmUser?.id || ''}
                        onChange={(e) => {
                            const id = Number(e.target.value);
                            const u = visibleUsers.find(x => x.id === id) || null;
                            setDmUser(u);
                        }}
                    >
                        <option value="" />
                        {visibleUsers.filter(u => u.id !== me.id).map(u => (
                            <option key={u.id} value={u.id}>{u.full_name || `#${u.id}`}</option>
                        ))}
                    </TextField>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenNewDm(false)} startIcon={<CloseRoundedIcon />}>انصراف</Button>
                    <Button variant="contained" onClick={() => dmUser && startDirect(dmUser.id)} disabled={!dmUser}>ایجاد</Button>
                </DialogActions>
            </Dialog>

            {/* دیالوگ خوانندگان */}
            <Dialog open={readersOpen} onClose={() => setReadersOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>چه کسانی خوانده‌اند؟</DialogTitle>
                <DialogContent dividers>
                    {readers.length ? (
                        <List dense>
                            {readers.map(r => (
                                <React.Fragment key={r.id}>
                                    <ListItemButton>
                                        <ListItemAvatar><Avatar>{(r.full_name || '#')[0]}</Avatar></ListItemAvatar>
                                        <ListItemText
                                            primary={r.full_name || `#${r.id}`}
                                            secondary={new Date(r.read_at).toLocaleString('fa-IR')}
                                        />
                                    </ListItemButton>
                                    <Divider />
                                </React.Fragment>
                            ))}
                        </List>
                    ) : <Typography variant="body2" color="text.secondary">هنوز کسی نخوانده.</Typography>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setReadersOpen(false)}>بستن</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );


}
function ManagerChatSection({ user }: { user: User }) {
    return <ChatApp me={user} />;
}
function SuperAdminChatSection({ user }: { user: User }) {
    return <ChatApp me={user} />;
}
function BranchManagerChatSection({ user }: { user: User }) {
    return <ChatApp me={user} />;
}
function OwnerChatSection({ user }: { user: User }) {
    return <ChatApp me={user} />;
}
function TechnicianChatSection({ user }: { user: User }) {
    return <ChatApp me={user} />;
}
function DriverChatSection({ user }: { user: User }) {
    return <ChatApp me={user} />;
}
