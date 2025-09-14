import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import api from '../services/api';
import {
    Box, Paper, Stack, Typography, IconButton, TextField, Button, Divider,
    List, ListItemButton, ListItemText, ListItemAvatar, Avatar, Badge, Chip,
    CircularProgress, Tooltip, InputAdornment, Dialog, DialogTitle, DialogContent,
    DialogActions, ListItem, Tabs, Tab,
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
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded';
import axios from 'axios'; // Make sure axios is imported at the top


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
    is_locked?: boolean; //  <-- این فیلد اضافه شود

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

api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) { config.headers.Authorization = `Bearer ${token}`; }
    return config;
});
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



const byOldestFirst = (a: Message, b: Message) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    if (ta !== tb) return ta - tb;   // older first
    return a.id - b.id;              // tie-breaker
};
const byNewestFirst = (a: Message, b: Message) => {
    const tb = new Date(b.created_at).getTime();
    const ta = new Date(a.created_at).getTime();
    if (tb !== ta) return tb - ta;
    return b.id - a.id;
};
function ChatApp({ me }: { me: User }) {
    const theme = useTheme();
    const [isMembersDialogOpen, setIsMembersDialogOpen] = useState(false);
    const [memberList, setMemberList] = useState<User[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    // ===== WS & refs
    const tokenRaw = useLocalToken();
    const token = useMemo(() => (tokenRaw || '').replace(/^Bearer\s+/i, ''), [tokenRaw]);
    const socketRef = useRef<Socket | null>(null);
    const safeEmitReadRef = useRef<(messageId: number) => Promise<void>>(async () => { });

    const listRef = useRef<HTMLDivElement | null>(null);
    const activeRoomIdRef = useRef<number | null>(null);
    const activeRoomRef = useRef<Room | null>(null);
    const lastWireRoomRef = useRef<{ kind: 'DIRECT' | 'GROUP'; peerId?: number; groupId?: number } | null>(null);
    const [tab, setTab] = useState<'GROUPS' | 'DIRECT'>('GROUPS'); // ⬅️ تب فعلی
    const [rooms, setRooms] = useState<Room[]>([]);
    // --- Message search state ---
    const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
    const [msgSearchOpen, setMsgSearchOpen] = useState(false);
    const [msgSearchQ, setMsgSearchQ] = useState('');
    const [msgSearchLoading, setMsgSearchLoading] = useState(false);
    const [msgSearchErr, setMsgSearchErr] = useState('');
    const [msgSearchResults, setMsgSearchResults] = useState<Message[]>([]);
    const [msgSearchBeforeId, setMsgSearchBeforeId] = useState<number | undefined>(undefined); // برای pagination نتایج
    const activeRoom = useMemo(() => rooms.find(r => r.id === activeRoomId) || null, [rooms, activeRoomId]);
    const [messages, setMessages] = useState<Message[]>([]);

    // برای هایلایت و اسکرول به پیام
    const [highlightedMsgId, setHighlightedMsgId] = useState<number | null>(null);
    // call backend search if available, otherwise local filter
    const doSearchMessages = useCallback(async (reset = true) => {
        if (!activeRoom || !msgSearchQ.trim()) { setMsgSearchResults([]); return; }
        setMsgSearchLoading(true);
        setMsgSearchErr('');
        try {
            // تلاش سمت سرور (اگر پیاده‌سازی شده باشد)
            const params: any = { q: msgSearchQ.trim(), limit: 30 };
            if (!reset && msgSearchBeforeId) params.beforeId = msgSearchBeforeId;

            const { data } = await api.get(`/chat/rooms/${activeRoom.id}/messages/search`, { params });

            if (Array.isArray(data)) {
                const arr: Message[] = data.map((m: any) => ({
                    id: Number(m.id),
                    room_id: activeRoom.id,
                    sender_id: Number(m.sender_id ?? m.senderId),
                    senderName: m.senderName || `کاربر #${m.sender_id ?? m.senderId}`,
                    kind: (m.kind ?? (m.attachment_url ? 'IMAGE' : 'TEXT')) as MessageKind,
                    text: m.text ?? null,
                    attachment_url: m.attachment_url ?? null,
                    attachment_mime: m.attachment_mime ?? null,
                    attachment_size: m.attachment_size ?? null,
                    created_at: new Date(m.created_at ?? m.createdAt ?? Date.now()).toISOString(),
                }));

                setMsgSearchResults(reset ? arr : [...msgSearchResults, ...arr]);
                setMsgSearchBeforeId(arr.length ? arr[arr.length - 1].id : msgSearchBeforeId);
            } else {
                // fallback: جستجوی کلاینتی توی پیام‌های لودشده
                const q = msgSearchQ.trim().toLowerCase();
                const local = messages.filter(m =>
                    (m.text || '').toLowerCase().includes(q)
                );
                setMsgSearchResults(local);
            }
        } catch (e: any) {
            // fallback کلاینتی اگر 404/501/… بود
            const q = msgSearchQ.trim().toLowerCase();
            const local = messages.filter(m => (m.text || '').toLowerCase().includes(q));
            setMsgSearchResults(local);
            if (!local.length) setMsgSearchErr(e?.response?.data?.message || 'جستجو ناموفق بود.');
        } finally {
            setMsgSearchLoading(false);
        }
    }, [activeRoom, msgSearchQ, msgSearchBeforeId, messages, msgSearchResults]);

    // اسکرول و هایلایت پیام
    // همه‌ی refهای آیتم‌های پیام را اینجا نگه می‌داریم:
    const msgElRefs = useRef<Record<number, HTMLDivElement | null>>({});

    // برای بایند کردن ref هر پیام:
    const bindMsgRef = useCallback(
        (id: number) => (el: HTMLDivElement | null) => {
            if (el) msgElRefs.current[id] = el;
            else delete msgElRefs.current[id];
        },
        []
    );

    // برای اسکرول و هایلایت کردن پیام پیدا‌شده:
    const scrollToMessage = useCallback((id: number) => {
        const el = msgElRefs.current[id];
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedMsgId(id);
        // بعد از 2 ثانیه هایلایت رو بردار
        window.setTimeout(() => setHighlightedMsgId(null), 2000);
    }, []);


    // اگر پیام هنوز لود نشده، چند صفحه قدیمی‌تر را لود کن تا پیدا شود
    const loadUntilFound = useCallback(async (targetId: number) => {
        // اگر الان هست، تمام
        if (messagesRef.current.some(m => m.id === targetId)) {
            scrollToMessage(targetId);
            return;
        }
        // تا 5 تلاش: هر بار 50 پیام قدیمی‌تر
        for (let i = 0; i < 5; i++) {
            const oldest = messagesRef.current[0];
            const beforeId = oldest ? oldest.id : undefined;
            try {
                setFetchingMsgs(true);
                const { data } = await api.get(`/chat/rooms/${activeRoom!.id}/messages`, {
                    params: { limit: 50, beforeId }
                });
                const arr: Message[] = Array.isArray(data) ? data.map((m: any) => ({
                    id: Number(m.id),
                    room_id: activeRoom!.id,
                    sender_id: Number(m.sender_id ?? m.senderId),
                    senderName: m.senderName || `کاربر #${m.sender_id ?? m.senderId}`,
                    kind: (m.kind ?? (m.attachment_url ? 'IMAGE' : 'TEXT')) as MessageKind,
                    text: m.text ?? null,
                    attachment_url: m.attachment_url ?? null,
                    attachment_mime: m.attachment_mime ?? null,
                    attachment_size: m.attachment_size ?? null,
                    created_at: new Date(m.created_at ?? m.createdAt ?? Date.now()).toISOString(),
                })) : [];

                if (!arr.length) break;

                // prepend
                setMessages(prev => {
                    const next = [...arr, ...prev];
                    next.sort(byOldestFirst);
                    return next;
                });

                await new Promise(r => setTimeout(r, 0)); // yield رندر

                if (messagesRef.current.some(m => m.id === targetId)) {
                    scrollToMessage(targetId);
                    return;
                }
            } finally {
                setFetchingMsgs(false);
            }
        }
        // پیدا نشد
        alert('پیام موردنظر در تاریخچه پیدا نشد.');
    }, [activeRoom, scrollToMessage, byOldestFirst]);

    const groupRooms = useMemo(
        () => rooms.filter(r => r.type !== 'DIRECT'),
        [rooms]
    );
    const directRooms = useMemo(
        () => rooms.filter(r => r.type === 'DIRECT'),
        [rooms]
    );
    const shownRooms = tab === 'GROUPS' ? groupRooms : directRooms; // ⬅️ لیستِ تب
    // pinned message state (per room)
    const [pinnedMsg, setPinnedMsg] = useState<Message | null>(null);
    const canPinInRoom = useMemo(() => {
        if (!activeRoom) return false;
        // در DIRECT: هردو طرف مجاز
        if (activeRoom.type === 'DIRECT') return true;
        // در GROUP: فقط نقش‌های 1 و 2
        return me.role_level === 1 || me.role_level === 2;
    }, [activeRoom, me.role_level]);


    // بارگذاری پیام پین‌شده هنگام عوض شدن اتاق
    const fetchPinned = useCallback(async (roomId: number) => {
        try {
            const { data } = await api.get(`/chat/rooms/${roomId}/pin`);
            if (!data) { setPinnedMsg(null); return; }
            const m: Message = {
                id: Number(data.id),
                room_id: roomId,
                sender_id: Number(data.sender_id ?? data.senderId),
                senderName: data.senderName || `کاربر #${data.sender_id ?? data.senderId}`,
                kind: (data.kind ?? (data.attachment_url ? 'IMAGE' : 'TEXT')) as MessageKind,
                text: data.text ?? null,
                attachment_url: data.attachment_url ?? null,
                attachment_mime: data.attachment_mime ?? null,
                attachment_size: data.attachment_size ?? null,
                created_at: new Date(data.created_at ?? data.createdAt ?? Date.now()).toISOString(),
            };
            setPinnedMsg(m);
        } catch {
            setPinnedMsg(null);
        }
    }, []);

    useEffect(() => {
        if (activeRoomId) fetchPinned(activeRoomId);
        else setPinnedMsg(null);
    }, [activeRoomId, fetchPinned]);

    // Pin/Unpin اقدام
    const pinMessage = useCallback(async (m: Message) => {
        if (!activeRoom || !canPinInRoom) return;
        const prev = pinnedMsg;
        setPinnedMsg(m); // optimistic
        try {
            await api.post(`/chat/rooms/${activeRoom.id}/pin`, { messageId: m.id });
        } catch (e: any) {
            setPinnedMsg(prev); // rollback
            alert(e?.response?.data?.message || 'پین کردن ناموفق بود.');
        }
    }, [activeRoom, canPinInRoom, pinnedMsg]);

    const unpinMessage = useCallback(async () => {
        if (!activeRoom || !canPinInRoom) return;
        const prev = pinnedMsg;
        setPinnedMsg(null); // optimistic
        try {
            await api.delete(`/chat/rooms/${activeRoom.id}/pin`);
        } catch (e: any) {
            setPinnedMsg(prev); // rollback
            alert(e?.response?.data?.message || 'برداشتن پین ناموفق بود.');
        }
    }, [activeRoom, canPinInRoom, pinnedMsg]);

    // اسکرول به پیام پین‌شده
    const gotoPinned = useCallback(() => {
        if (!pinnedMsg) return;
        if (!messagesRef.current.some(x => x.id === pinnedMsg.id)) {
            loadUntilFound(pinnedMsg.id);
        } else {
            scrollToMessage(pinnedMsg.id);
        }
    }, [pinnedMsg, loadUntilFound, scrollToMessage]);

    // ===== State
    const [pinDlgOpen, setPinDlgOpen] = useState(false);
    const [pinDlgTarget, setPinDlgTarget] = useState<Message | null>(null);

    const openPinDialog = useCallback((m: Message) => {
        if (!canPinInRoom) return;
        setPinDlgTarget(m);
        setPinDlgOpen(true);
    }, [canPinInRoom]);

    const handlePinConfirm = useCallback(async () => {
        if (!pinDlgTarget) return;
        setPinDlgLoading(true);
        try {
            if (pinnedMsg?.id === pinDlgTarget.id) {
                await unpinMessage();
            } else {
                await pinMessage(pinDlgTarget);
            }
        } finally {
            setPinDlgLoading(false);
            setPinDlgOpen(false);
            setPinDlgTarget(null);
        }
    }, [pinDlgTarget, pinnedMsg, pinMessage, unpinMessage]);


    const [hasMore, setHasMore] = useState(true);
    const [fetchingMsgs, setFetchingMsgs] = useState(false);

    const [presence, setPresence] = useState<number[]>([]);
    const [typingUsers, setTypingUsers] = useState<number[]>([]);
    const [searchQ, setSearchQ] = useState('');
    const [visibleUsers, setVisibleUsers] = useState<User[]>([]);
    const [openNewDm, setOpenNewDm] = useState(false);
    const [dmUser, setDmUser] = useState<User | null>(null);
    const messagesRef = useRef<Message[]>([]);

    const isInputDisabled = !!(activeRoom?.is_locked && me.role_level !== 2);
    const disabledTooltip = "این گروه قفل شده و فقط مدیر می‌تواند پیام ارسال کند.";
    const handleOpenMembersDialog = useCallback(async () => {
        if (!activeRoom || activeRoom.type === 'DIRECT') return;

        setIsMembersDialogOpen(true);
        setLoadingMembers(true);
        setMemberList([]);
        try {
            // This is the new endpoint you need to create on the backend
            const { data } = await api.get(`/chat/rooms/${activeRoom.id}/members`);
            setMemberList(Array.isArray(data) ? data : []);
        } catch (err: any) {
            alert(err?.response?.data?.message || 'خطا در دریافت لیست اعضا.');
        } finally {
            setLoadingMembers(false);
        }
    }, [activeRoom]);
    const handleToggleLock = useCallback(async () => {
        if (!activeRoom || me.role_level !== 2) return;

        const originalRooms = rooms;
        const newLockState = !activeRoom.is_locked;

        // آپدیت خوش‌بینانه UI
        setRooms(prev =>
            prev.map(r =>
                r.id === activeRoom.id ? { ...r, is_locked: newLockState } : r
            )
        );

        try {
            await api.patch(`/chat/rooms/${activeRoom.id}/toggle-lock`);
        } catch (err) {
            // بازگردانی UI در صورت بروز خطا
            let errorMessage = 'تغییر وضعیت قفل گروه ناموفق بود.';

            // بررسی ایمن نوع خطا قبل از دسترسی به پراپرتی‌ها
            if (axios.isAxiosError(err) && err.response?.data?.message) {
                errorMessage = err.response.data.message;
            }

            alert(errorMessage);
            setRooms(originalRooms);
        }
    }, [activeRoom, me.role_level, rooms]);

    useEffect(() => {
        safeEmitReadRef.current = async (messageId: number) => {
            const s = socketRef.current;
            const ar = activeRoomRef.current;
            const myId = me?.id;

            if (!s || !ar || !myId) return;
            if (sentReadsRef.current.has(messageId)) return;

            sentReadsRef.current.add(messageId);

            const payload =
                ar.type === 'DIRECT'
                    ? (() => {
                        const [a, b] = (ar.direct_key ?? '').split('-').map(Number);
                        if (Number.isNaN(a) || Number.isNaN(b)) return { messageId, kind: 'DIRECT' as const };
                        return { messageId, kind: 'DIRECT' as const, peerId: myId === a ? b : a };
                    })()
                    : { messageId, kind: 'GROUP' as const, groupId: ar.id };

            try {
                await s.timeout(10000).emitWithAck('chat.message.read', payload);
                // console.log(`[FE] Read confirmation sent for ${messageId}`);
            } catch (err) {
                // اگر شکست خورد، اجازه بده دوباره ارسال شود
                sentReadsRef.current.delete(messageId);
                console.error(`[FE] read-ack failed`, err);
            }
        };
    }, [me?.id]);

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
    const applyRoomLockUpdate = useCallback((roomId: number, isLocked: boolean) => {
        setRooms(prev => prev.map(r => r.id === roomId ? { ...r, is_locked: isLocked } : r));
    }, []);



    useEffect(() => {
        const list = tab === 'GROUPS' ? groupRooms : directRooms;
        if (!list.length) {
            setActiveRoomId(null);
            return;
        }
        if (!list.some(r => r.id === activeRoomId)) {
            setActiveRoomId(list[0].id);
        }
    }, [tab, groupRooms, directRooms]); // ⬅️ تب یا اتاق‌های تب عوض شد

    useEffect(() => {
        const loadReads = async () => {
            if (!activeRoom || !messages.length) {
                setReadsByMsg({});
                return;
            }

            const messageIds = messages.map(m => m.id);
            if (messageIds.length === 0) {
                setReadsByMsg({});
                return;
            }
            const myMsgIds = messages.filter(m => m.sender_id === me.id).map(m => m.id);
            if (!myMsgIds.length) { setReadsByMsg({}); return; }
            try {

                const res = await api.post(`/chat/rooms/${activeRoom.id}/readers-map`, { ids: messageIds });


                const map: Record<number, number[]> = res.data;
                const newReadsByMsg: Record<number, Record<number, true>> = {};

                for (const [msgIdStr, readerIds] of Object.entries(map)) {
                    const msgId = Number(msgIdStr);
                    if (Number.isNaN(msgId)) continue;
                    newReadsByMsg[msgId] = {};
                    for (const readerId of readerIds) {
                        newReadsByMsg[msgId][readerId] = true;
                    }
                }

                setReadsByMsg(newReadsByMsg);
            } catch (err) {
                console.error("Failed to load message read status:", err);

            }
        };

        loadReads();
    }, [messages, activeRoom]); // وابستگی به messages و activeRoom
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


    // نزدیکِ پایین؟
    const isNearBottom = () => {
        const el = listRef.current; if (!el) return true;
        return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };




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
    // ===== HTTP: rooms / messages / users
    const loadRooms = useCallback(async () => {
        const { data } = await api.get('/chat/rooms');
        const rs: Room[] = Array.isArray(data) ? data : [];
        setRooms(rs);
        ensurePeerUsersInCache(rs);
    }, []); // ← بدون وابستگی به state



    const refreshRoomState = useCallback(async (roomId: number) => {
        try {
            // اگر API تکی ندارید، می‌توانید از loadRooms() استفاده کنید
            const { data } = await api.get(`/chat/rooms/${roomId}`);
            if (!data) return;

            const locked =
                Boolean(data.is_locked ?? data.isLocked ?? data.locked);

            setRooms(prev =>
                prev.map(r => (r.id === roomId ? { ...r, is_locked: locked, title: data.title ?? r.title } : r))
            );
        } catch (e: any) {
            // fallback: اگر endpoint تکی ندارید
            try { await loadRooms(); } catch { }
        }
    }, [loadRooms]);
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

            for (const m of arr) if (m.sender_id !== me.id) safeEmitReadRef.current(m.id);

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
    const [pinDlgLoading, setPinDlgLoading] = useState(false);


    // ===== WS connect
    // --- 2) افکت وب‌سوکت با رویدادهای قفل/بازشدن ---
    useEffect(() => {
        const WS_URL =
            import.meta.env.VITE_WS_URL ||
            (api.defaults.baseURL ? new URL(api.defaults.baseURL).origin : window.location.origin);

        if (socketRef.current) return;

        const s = io(WS_URL, {
            path: '/ws',
            withCredentials: true,
            auth: { token }, // توکن از localStorage
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 500,
            reconnectionDelayMax: 5000,
        });

        socketRef.current = s;

        // ---- Handlers به صورت function تا در cleanup off() کنیم ----
        const onConnect = () => {
            console.log('[FE] CONNECTED', s.id);
            if (activeRoomRef.current) {
                joinRoomWs(activeRoomRef.current);
            }
        };

        const onConnectError = (err: any) => {
            console.error('[FE] CONNECT_ERR', {
                message: err?.message,
                description: err?.description,
                context: err,
            });
        };

        const onMessageNew = (m: any) => {
            try {
                const ar = activeRoomRef.current;
                if (!ar) return;

                // نرمال‌سازی فیلدها
                const attUrl = m.attachment_url ?? m.attachmentUrl ?? null;
                const attMime = m.attachment_mime ?? m.attachmentMime ?? null;
                const attSize = m.attachment_size ?? m.attachmentSize ?? null;
                const created = m.created_at ?? m.createdAt ?? new Date().toISOString();
                const kind: MessageKind = m.kind ? m.kind : (attUrl ? 'IMAGE' : 'TEXT');

                const senderId = Number(m?.senderId ?? m?.sender_id);
                const roomKind = m?.room?.kind as 'GROUP' | 'DIRECT' | undefined;
                const groupId = Number(m?.room?.groupId ?? m?.room_id ?? NaN);
                const peerId = roomKind === 'DIRECT' ? Number(m?.room?.peerId ?? NaN) : null;

                // فیلتر تعلق پیام به اتاق فعال
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
                    created_at:
                        typeof created === 'string'
                            ? new Date(created).toISOString()
                            : (created instanceof Date ? created.toISOString() : new Date().toISOString()),
                };

                setMessages(prev => {
                    if (prev.some(x => x.id === msg.id)) return prev;
                    const next = [...prev, msg];
                    next.sort(byOldestFirst);
                    return next;
                });

                if (msg.sender_id !== me.id) safeEmitReadRef.current(msg.id);
                if (listRef.current) {
                    const nearBottom =
                        listRef.current.scrollHeight - listRef.current.scrollTop - listRef.current.clientHeight < 80;
                    if (nearBottom) requestAnimationFrame(() => {
                        listRef.current!.scrollTop = listRef.current!.scrollHeight;
                    });
                }

                setReadsByMsg(prev => (prev[msg.id] ? prev : ({ ...prev, [msg.id]: {} })));
            } catch (err) {
                console.error('[FE] message:new HANDLER_ERROR', err, { incoming: m, activeRoom: activeRoomRef.current });
            }
        };

        const onMessageRead = (evt: any) => {
            const messageId = Number(evt?.messageId);
            const readerId = Number(evt?.readerId);
            if (!messageId || !readerId) return;
            setReadsByMsg(prev => {
                const prevReaders = prev[messageId] || {};
                if (prevReaders[readerId]) return prev;
                return { ...prev, [messageId]: { ...prevReaders, [readerId]: true } };
            });
        };

        const onPresenceJoin = (p: { userId: number; room: string }) => {
            const ar = activeRoomRef.current; if (!ar) return;
            const ok = (
                ar.type === 'DIRECT'
                    ? p.room === `DM:${Math.min(me.id, dmPeerId(ar, me.id) || 0)}:${Math.max(me.id, dmPeerId(ar, me.id) || 0)}`
                    : p.room === `GRP:${ar.id}`
            );
            if (ok) setPresence(prev => (prev.includes(p.userId) ? prev : [...prev, p.userId]));
        };

        const onPresenceLeave = (p: { userId: number; room: string }) => {
            const ar = activeRoomRef.current; if (!ar) return;
            const ok = (
                ar.type === 'DIRECT'
                    ? p.room === `DM:${Math.min(me.id, dmPeerId(ar, me.id) || 0)}:${Math.max(me.id, dmPeerId(ar, me.id) || 0)}`
                    : p.room === `GRP:${ar.id}`
            );
            if (ok) setPresence(prev => prev.filter(id => id !== p.userId));
        };

        const onTypingStarted = (p: { userId: number; room: string }) => {
            if (p.userId === me.id) return;
            const ar = activeRoomRef.current; if (!ar) return;
            const ok = (
                ar.type === 'DIRECT'
                    ? p.room === `DM:${Math.min(me.id, dmPeerId(ar, me.id) || 0)}:${Math.max(me.id, dmPeerId(ar, me.id) || 0)}`
                    : p.room === `GRP:${ar.id}`
            );
            if (ok) setTypingUsers(prev => (prev.includes(p.userId) ? prev : [...prev, p.userId]));
        };

        const onTypingStopped = (p: { userId: number; room: string }) => {
            setTypingUsers(prev => prev.filter(id => id !== p.userId));
        };

        // --- 🔒 رویدادهای قفل/بازشدن (چند نام برای سازگاری) ---
        const onRoomUpdated = (payload: any) => {
            const room = payload?.room ?? payload;
            if (!room) return;
            const id = Number(room.id ?? room.roomId);
            const isLocked = Boolean(room.is_locked ?? room.isLocked ?? room.locked);
            if (!Number.isFinite(id)) return;
            applyRoomLockUpdate(id, isLocked);
        };

        const onRoomLocked = (payload: any) => {
            const id = Number(payload?.roomId ?? payload?.id);
            if (!Number.isFinite(id)) return;
            applyRoomLockUpdate(id, true);
        };

        const onRoomUnlocked = (payload: any) => {
            const id = Number(payload?.roomId ?? payload?.id);
            if (!Number.isFinite(id)) return;
            applyRoomLockUpdate(id, false);
        };

        const onUploadLimit = (p: { defaultMaxBytes?: number; roomId?: number; maxBytes?: number }) => {
            if (p.defaultMaxBytes != null) setDefaultMaxBytes(p.defaultMaxBytes);
            if (p.roomId && p.maxBytes != null) setRoomMaxBytes(prev => ({ ...prev, [p.roomId!]: p.maxBytes! }));
        };
        const onPinChanged = (payload: any) => {
            const roomId = Number(payload?.roomId ?? payload?.room?.id ?? payload?.id);
            if (!activeRoomRef.current || !Number.isFinite(roomId) || roomId !== activeRoomRef.current.id) return;

            const msg = payload?.message ?? payload?.msg ?? null;
            if (!msg) {
                setPinnedMsg(null);
                return;
            }
            // نرمال‌سازی پیام
            const m: Message = {
                id: Number(msg.id),
                room_id: roomId,
                sender_id: Number(msg.sender_id ?? msg.senderId),
                senderName: msg.senderName || `کاربر #${msg.sender_id ?? msg.senderId}`,
                kind: (msg.kind ?? (msg.attachment_url ? 'IMAGE' : 'TEXT')) as MessageKind,
                text: msg.text ?? null,
                attachment_url: msg.attachment_url ?? null,
                attachment_mime: msg.attachment_mime ?? null,
                attachment_size: msg.attachment_size ?? null,
                created_at: new Date(msg.created_at ?? msg.createdAt ?? Date.now()).toISOString(),
            };
            setPinnedMsg(m);
        };

        s.on('chat.room.pin.changed', onPinChanged);
        s.on('room:pin.changed', onPinChanged);
        s.on('room:pinned', onPinChanged);
        s.on('room:unpinned', () => {
            const ar = activeRoomRef.current;
            if (ar) setPinnedMsg(null);
        });

        // cleanup:
        s.off('chat.room.pin.changed', onPinChanged);
        s.off('room:pin.changed', onPinChanged);
        s.off('room:pinned', onPinChanged);
        s.off('room:unpinned', () => { });

        // ---- ثبت لیسنرها ----
        s.on('connect', onConnect);
        s.on('connect_error', onConnectError);
        s.on('message:new', onMessageNew);
        s.on('message:read', onMessageRead);
        s.on('presence.join', onPresenceJoin);
        s.on('presence.leave', onPresenceLeave);
        s.on('typing.started', onTypingStarted);
        s.on('typing.stopped', onTypingStopped);

        // قفل/باز شدن اتاق
        s.on('room:updated', onRoomUpdated);
        s.on('chat.room.updated', onRoomUpdated);
        s.on('chat.room.locked', onRoomLocked);
        s.on('chat.room.unlocked', onRoomUnlocked);

        // سایر
        s.on('config.upload_limit_updated', onUploadLimit);

        // ---- Cleanup ----
        return () => {
            s.off('connect', onConnect);
            s.off('connect_error', onConnectError);
            s.off('message:new', onMessageNew);
            s.off('message:read', onMessageRead);
            s.off('presence.join', onPresenceJoin);
            s.off('presence.leave', onPresenceLeave);
            s.off('typing.started', onTypingStarted);
            s.off('typing.stopped', onTypingStopped);

            s.off('room:updated', onRoomUpdated);
            s.off('chat.room.updated', onRoomUpdated);
            s.off('chat.room.locked', onRoomLocked);
            s.off('chat.room.unlocked', onRoomUnlocked);

            s.off('config.upload_limit_updated', onUploadLimit);

            s.disconnect();
            socketRef.current = null;
        };
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
    const safeEmitRead = useCallback(async (messageId: number) => {
        const s = socketRef.current;
        if (!s || !activeRoom || !me) return;
        if (sentReadsRef.current.has(messageId)) return; // قبلاً ارسال شده

        sentReadsRef.current.add(messageId);
        try {
            await s.timeout(10000).emitWithAck('chat.message.read', {
                messageId,
                kind: activeRoom.type === 'DIRECT' ? 'DIRECT' : 'GROUP',   // ⬅️ قبلاً SA_GROUP بود
                groupId: activeRoom.type !== 'DIRECT' ? activeRoom.id : undefined,
                peerId:
                    activeRoom.type === 'DIRECT'
                        ? (() => {
                            const [a, b] = (activeRoom.direct_key ?? '').split('-').map(Number); // ⬅️ عددی‌سازی
                            if (Number.isNaN(a) || Number.isNaN(b)) return undefined;
                            return me.id === a ? b : a;
                        })()
                        : undefined,
            });

            console.log(`[FE] Read confirmation sent for message ${messageId}`);
        } catch (err) {
            console.error(`[FE] Failed to send read confirmation for message ${messageId}:`, err);
            // در صورت خطا، ممکن است بخواهید messageId را از sentReadsRef.current حذف کنید تا دوباره تلاش کند
            sentReadsRef.current.delete(messageId);
        }
    }, [activeRoom, me, dmPeerId]); // ✅ FIX: Added dmPeerId dependency
    useEffect(() => {
        const s = socketRef.current;
        if (!s) return;

        const handleMessageRead = (payload: { messageId: number; readerId: number }) => {
            const { messageId, readerId } = payload;
            setReadsByMsg(prev => {
                const updated = { ...(prev[messageId] || {}) };
                updated[readerId] = true;
                return { ...prev, [messageId]: updated };
            });
        };


    }, []);



    // PATCH: اسکرول
    const wantInitialScrollRef = useRef(false);

    const scrollToBottom = () => {
        const el = listRef.current; if (!el) return;
        el.scrollTop = el.scrollHeight;
    };
    const scrollToBottomAfterPaint = () => {
        requestAnimationFrame(() => {
            requestAnimationFrame(scrollToBottom);
        });
    };


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
    useEffect(() => {
        if (!messages.length) return;
        if (!wantInitialScrollRef.current) return;

        scrollToBottomAfterPaint();     // PATCH: اسکرول واقعا بعد از رندر
        wantInitialScrollRef.current = false;
    }, [messages.length, activeRoomId]);

    // ===== lifecycle
    useEffect(() => { loadVisibleUsers(); loadRooms(); }, []); // ← فقط یکبار
    // فقط گرفتن پیام‌ها، فقط وقتی activeRoomId عوض شد
    useEffect(() => {
        if (!activeRoomId) return;
        wantInitialScrollRef.current = true;
        fetchMessages(activeRoomId, true);
    }, [activeRoomId]); // ← rooms حذف شد

    // فقط join WS، فقط وقتی activeRoomId عوض شد
    const roomsRef = useRef<Room[]>([]);
    useEffect(() => { roomsRef.current = rooms; }, [rooms]);

    useEffect(() => {
        const r = roomsRef.current.find(x => x.id === activeRoomId) || null;
        joinRoomWs(r);
    }, [activeRoomId, joinRoomWs]); // ← rooms حذف شد



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
    const lockCheckAtRef = useRef(0);

    const handleTyping = useCallback((val: string) => {
        const ar = activeRoomRef.current;
        if (!ar) return;
        if (ar.is_locked && me.role_level !== 2) return; // گارد محلی

        setInput(val);

        const s = socketRef.current; if (!s) return;
        const wire = toWireRoom(ar, me.id);
        s.emit('typing.start', wire);
        if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = window.setTimeout(() => {
            s.emit('typing.stop', wire);
            typingTimerRef.current = null;
        }, 1200);
    }, [me.id, me.role_level, toWireRoom]);
    // ← refreshRoomState از اینجا حذف شد


    // در داخل ChatApp، جایگزین کنید:
    const handleSend = useCallback(async () => {
        if (activeRoom?.is_locked && me.role_level !== 2) {
            return; // مسدود اگر قفل است و کاربر مدیر نیست
        }

        const s = socketRef.current;
        if (!activeRoom || !s) return;

        // ⛔️ اگر قفل است و کاربر سوپرادمین نیست، اجازه‌ی ارسال نده (حتی اگر UI هنوز آپدیت نشده)
        if (activeRoom.is_locked && me.role_level !== 2) {
            alert('این گروه قفل است و فقط مدیر می‌تواند پیام ارسال کند.');
            return;
        }

        if (!s.connected) {
            console.warn('[FE] socket not connected yet, waiting…');
            await new Promise<void>((resolve) => s.once('connect', () => resolve()));
        }

        const text = input.trim();
        const hasText = !!text;
        const hasFile = !!file;
        if (!hasText && !hasFile) return;

        if (hasFile) {
            if (!file!.type.startsWith('image/')) {
                alert('فقط فایل‌های تصویری مجاز هستند.');
                return;
            }
            if (file!.size > uploadLimitBytes) {
                alert(`حجم فایل بیش از حد مجاز (${Math.floor(uploadLimitBytes / 1024 / 1024)}MB) است.`);
                return;
            }
        }

        const wire = toWireRoom(activeRoom, me.id);
        let messageSent = false;

        try {
            if (hasFile) {
                const form = new FormData();
                form.append('file', file!);
                const { data: savedImg } = await api.post(`/chat/rooms/${activeRoom.id}/messages/image`, form);
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
                    setMessages(prev => {
                        if (prev.some(m => m.id === processedMessage.id)) return prev;
                        const next = [...prev, processedMessage];
                        next.sort(byOldestFirst);
                        return next;
                    });
                    if (isNearBottom()) requestAnimationFrame(scrollToBottom);
                    messageSent = true;
                }
            }

            if (hasText) {
                const ack = await s.timeout(5000).emitWithAck('chat.message.send', { ...wire, text });
                // اگر سرور خطای «قفل بودن اتاق» برگرداند:
                if (ack && (ack.error === 'ROOM_LOCKED' || ack.code === 'ROOM_LOCKED')) {
                    alert('این گروه قفل است و فقط مدیر می‌تواند پیام ارسال کند.');
                    return;
                }
                messageSent = true;
            }

            if (messageSent) { setInput(''); setFile(null); }

        } catch (e: any) {
            const msg = e?.response?.data?.message || e?.message || 'ارسال پیام ناموفق بود.';
            alert(msg);
        }
    }, [activeRoom?.is_locked, me.role_level, activeRoom, input, file, me.id, toWireRoom, uploadLimitBytes]);

    return (
        <Box sx={{ p: 2, height: 'calc(100vh - 64px)' }}>

            <Stack direction="row" spacing={2} sx={{ height: '100%' }}>
                {/* Sidebar */}
                <Paper elevation={0} sx={(t) => ({ ...fancyCard(t), width: 320, p: 1.25, display: 'flex', flexDirection: 'column' })}>
                    {/* Header */}
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: .5, pb: .5 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography fontWeight={800}>گفتگوها</Typography>
                        </Stack>

                        {/* دکمه ساخت DM فقط در تب خصوصی */}
                        {tab === 'DIRECT' && (
                            <Tooltip title="شروع گفتگوی خصوصی">
                                <IconButton size="small" onClick={() => setOpenNewDm(true)}>
                                    <AddRoundedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Stack>

                    {/* ⬇️ تب‌ها */}
                    <Tabs
                        value={tab}
                        onChange={(_, v) => setTab(v)}
                        variant="fullWidth"
                        sx={{ mb: 1 }}
                    >
                        <Tab
                            value="GROUPS"
                            label="گروه‌ها"
                            icon={<GroupsRoundedIcon fontSize="small" />}
                            iconPosition="start"
                        />
                        <Tab
                            value="DIRECT"
                            label="خصوصی"
                            icon={<PersonRoundedIcon fontSize="small" />}
                            iconPosition="start"
                        />
                    </Tabs>


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
                            {shownRooms
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
                        <Stack direction="row" spacing={1.5} alignItems="center" minWidth={0}>
                            {activeRoom?.type === 'DIRECT' ? <PersonRoundedIcon /> : <GroupsRoundedIcon />}
                            <Box>
                                <Typography fontWeight={900} noWrap>{activeRoom ? roomTitle(activeRoom) : '—'}</Typography>

                                {activeRoom && activeRoom.type !== 'DIRECT' && (
                                    <Button
                                        size="small"
                                        onClick={handleOpenMembersDialog}
                                        sx={{ p: 0, color: 'text.secondary', textTransform: 'none', textAlign: 'left', justifyContent: 'flex-start' }}
                                    >
                                        {presence.length} نفر حاضر
                                    </Button>
                                )}
                            </Box>
                        </Stack>

                        <Stack direction="row" spacing={1} alignItems="center">
                            {me.role_level === 2 && activeRoom && activeRoom.type !== 'DIRECT' && (
                                <Tooltip title={activeRoom.is_locked ? 'باز کردن گروه' : 'قفل کردن گروه'}>
                                    <IconButton onClick={handleToggleLock} size="small">
                                        {activeRoom.is_locked ? <LockRoundedIcon color="warning" /> : <LockOpenRoundedIcon />}
                                    </IconButton>
                                </Tooltip>
                            )}

                            {/* دکمهٔ جستجوی پیام‌ها */}
                            <Tooltip title="جستجوی پیام‌ها">
                                <IconButton
                                    size="small"
                                    onClick={() => {
                                        setMsgSearchOpen(true);
                                        setMsgSearchResults([]);
                                        setMsgSearchBeforeId(undefined);
                                    }}
                                >
                                    <SearchRoundedIcon />
                                </IconButton>
                            </Tooltip>

                            <Tooltip title={`حداکثر آپلود: ${Math.floor(uploadLimitBytes / 1024 / 1024)}MB`}>
                                <InfoOutlinedIcon sx={{ opacity: .7 }} />
                            </Tooltip>
                        </Stack>
                    </Stack>

                    {/* 🔶 بنر پیامِ پین‌شده زیر هدر */}
                    {pinnedMsg && (
                        <Box
                            sx={(t) => ({
                                mx: 1.25, mb: 1, p: 1,
                                borderRadius: 2,
                                border: '1px dashed',
                                borderColor: alpha(t.palette.warning.main, .5),
                                bgcolor: alpha(t.palette.warning.main, .08),
                                display: 'flex', alignItems: 'center', gap: 1,
                            })}
                        >
                            <Box sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={gotoPinned} title="رفتن به پیام پین‌شده">
                                <Typography variant="caption" sx={{ fontWeight: 700 }} noWrap>
                                    {pinnedMsg.senderName}
                                </Typography>
                                {pinnedMsg.text
                                    ? <Typography variant="body2" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pinnedMsg.text}</Typography>
                                    : <Typography variant="body2" color="text.secondary">[ضمیمه]</Typography>
                                }
                            </Box>
                            {canPinInRoom && (
                                <Tooltip title="برداشتن پین">
                                    <IconButton size="small" onClick={unpinMessage}>
                                        <CloseRoundedIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </Box>
                    )}

                    {/* Messages */}
                    <Box ref={listRef} sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                        {fetchingMsgs && !messages.length ? (
                            <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
                                <CircularProgress size={24} />
                            </Box>
                        ) : (
                            <Stack spacing={1}>
                                {messages.map((m) => {
                                    const mine = m.sender_id === me.id;
                                    const isFile = !!m.attachment_url || m.kind !== 'TEXT';
                                    return (
                                        <Box
                                            key={m.id}
                                            ref={bindMsgRef(m.id)}
                                            sx={{
                                                display: 'flex',
                                                justifyContent: mine ? 'flex-start' : 'flex-end',
                                                transition: 'box-shadow .2s, outline-color .2s, background-color .2s',
                                                outline: m.id === highlightedMsgId ? '2px solid' : '2px solid transparent',
                                                outlineColor: m.id === highlightedMsgId ? alpha(theme.palette.warning.main, .8) : 'transparent',
                                                borderRadius: 2,
                                            }}
                                        >
                                            <Paper
                                                elevation={0}
                                                onClick={(e) => {
                                                    if (!canPinInRoom) return;
                                                    const el = e.target as HTMLElement;
                                                    // اگر روی عنصر تعاملی کلیک شده، دیالوگ باز نشه
                                                    if (el.closest('a, button, input, textarea, select, img, video, audio')) return;
                                                    openPinDialog(m);
                                                }}
                                                sx={(t) => ({
                                                    position: 'relative',
                                                    maxWidth: '72%',
                                                    p: 1,
                                                    borderRadius: (m.sender_id === me.id)
                                                        ? '12px 12px 12px 4px'
                                                        : '12px 12px 4px 12px',
                                                    bgcolor: (m.sender_id === me.id)
                                                        ? alpha(t.palette.primary.main, .10)
                                                        : alpha(t.palette.text.primary, .06),
                                                    border: '1px solid',
                                                    borderColor: (m.sender_id === me.id)
                                                        ? alpha(t.palette.primary.main, .35)
                                                        : 'divider',
                                                    cursor: canPinInRoom ? 'pointer' : 'default',
                                                })}
                                            >

                                                {/* 🎯 دکمهٔ Pin/Unpin روی هر پیام */}
                                                {canPinInRoom && (
                                                    <Box sx={{
                                                        position: 'absolute',
                                                        top: 6,
                                                        [mine ? 'left' : 'right']: 6,
                                                    }}>
                                                        <Tooltip title={pinnedMsg?.id === m.id ? 'برداشتن پین' : 'پین کردن'}>
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (pinnedMsg?.id === m.id) unpinMessage();
                                                                    else pinMessage(m);
                                                                }}
                                                            >

                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                )}

                                                <Stack spacing={.5}>
                                                    {/* نام فرستنده برای پیام‌های دیگران */}
                                                    {!mine && (
                                                        <Typography variant="caption" color="text.secondary" fontWeight="bold">
                                                            {m.senderName || `کاربر #${m.sender_id}`}
                                                        </Typography>
                                                    )}

                                                    {/* متن/فایل */}
                                                    {isFile ? (
                                                        <>
                                                            {(m.kind === 'IMAGE' || (m.attachment_mime && m.attachment_mime.startsWith('image/'))) ? (
                                                                <Box sx={{ my: 0.5 }}>
                                                                    <img
                                                                        src={absolutize(m.attachment_url)!}
                                                                        alt=""
                                                                        style={{ maxWidth: 280, borderRadius: 8 }}
                                                                    />
                                                                </Box>
                                                            ) : (
                                                                <a href={absolutize(m.attachment_url)!} target="_blank" rel="noreferrer">
                                                                    دانلود فایل
                                                                </a>
                                                            )}
                                                            {m.text && m.text.trim() !== '' && (
                                                                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{m.text}</Typography>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <Typography sx={{ whiteSpace: 'pre-wrap' }}>{m.text}</Typography>
                                                    )}

                                                    {/* زمان + تیک‌ها */}
                                                    <Stack direction="row" alignItems="center" spacing={0.75} justifyContent="flex-end">
                                                        <Typography variant="caption" color="text.secondary" dir="ltr">
                                                            {new Date(m.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                                                        </Typography>
                                                        {m.sender_id === me.id && (
                                                            isReadByOtherThanSender(m)
                                                                ? <DoneAllRoundedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                                                                : <DoneRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                                        )}
                                                    </Stack>
                                                </Stack>
                                            </Paper>
                                        </Box>
                                    );
                                })}
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
                    <Box sx={{ position: 'relative' }}>
                        {isInputDisabled && (
                            <Tooltip title={disabledTooltip}>
                                <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2, cursor: 'not-allowed' }} />
                            </Tooltip>
                        )}
                        <Stack direction="row" spacing={1} sx={{ p: 1.25, opacity: isInputDisabled ? 0.6 : 1 }}>
                            {/* ... همان ورودی/ارسال قبلی ... */}
                        </Stack>
                    </Box>

                    {file && (
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, pb: 1 }}>
                            <Chip label={`${file.name} — ${(file.size / 1024 / 1024).toFixed(1)}MB`} onDelete={() => setFile(null)} deleteIcon={<CloseRoundedIcon />} />
                        </Stack>
                    )}
                </Paper>


            </Stack>
            <Dialog
                open={pinDlgOpen}
                onClose={() => { setPinDlgOpen(false); setPinDlgTarget(null); }}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>پین کردن پیام</DialogTitle>
                <DialogContent dividers>
                    {pinDlgTarget ? (
                        <Stack spacing={1}>
                            <Typography variant="subtitle2">{pinDlgTarget.senderName}</Typography>
                            {pinDlgTarget.text
                                ? <Typography sx={{ whiteSpace: 'pre-wrap' }}>{pinDlgTarget.text}</Typography>
                                : <Typography color="text.secondary">[بدون متن / دارای ضمیمه]</Typography>}
                        </Stack>
                    ) : (
                        <Typography color="text.secondary">پیامی انتخاب نشده است.</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => { setPinDlgOpen(false); setPinDlgTarget(null); }}
                        disabled={pinDlgLoading}
                    >
                        انصراف
                    </Button>

                    <Button
                        variant="contained"
                        color={(pinnedMsg && pinDlgTarget?.id === pinnedMsg.id) ? 'warning' : 'primary'}
                        onClick={handlePinConfirm}
                        disabled={!pinDlgTarget || pinDlgLoading}
                    >
                        {(pinnedMsg && pinDlgTarget?.id === pinnedMsg.id) ? 'برداشتن پین' : 'پین'}
                        {pinDlgLoading && <CircularProgress size={16} sx={{ ml: 1 }} />}
                    </Button>
                </DialogActions>
            </Dialog>

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
            {/* این دیالوگ جدید به انتهای JSX اضافه می‌شود */}
            <Dialog open={isMembersDialogOpen} onClose={() => setIsMembersDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>اعضای گروه</DialogTitle>
                <DialogContent dividers>
                    {loadingMembers ? (
                        <Box sx={{ display: 'grid', placeItems: 'center', p: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <List dense>
                            {memberList.length > 0 ? memberList.map(member => (
                                <ListItem key={member.id} disablePadding>
                                    <ListItemButton>
                                        <ListItemAvatar>
                                            <Badge
                                                color="success"
                                                variant="dot"
                                                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                                invisible={!presence.includes(member.id)}
                                            >
                                                <Avatar>{(member.full_name || '#')[0]}</Avatar>
                                            </Badge>
                                        </ListItemAvatar>
                                        <ListItemText primary={member.full_name || `کاربر #${member.id}`} />
                                    </ListItemButton>
                                </ListItem>
                            )) : (
                                <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                                    عضوی یافت نشد.
                                </Typography>
                            )}
                        </List>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsMembersDialogOpen(false)}>بستن</Button>
                </DialogActions>
            </Dialog>
            <Dialog open={msgSearchOpen} onClose={() => setMsgSearchOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>جستجوی پیام‌ها</DialogTitle>
                <DialogContent dividers>
                    <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                        <TextField
                            fullWidth size="small" label="عبارت جستجو"
                            value={msgSearchQ}
                            onChange={(e) => setMsgSearchQ(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') doSearchMessages(true); }}
                        />
                        <Button variant="contained" onClick={() => doSearchMessages(true)} disabled={!msgSearchQ.trim()}>
                            جستجو
                        </Button>
                    </Stack>

                    {msgSearchLoading && <Box sx={{ py: 2, textAlign: 'center' }}><CircularProgress size={20} /></Box>}
                    {!!msgSearchErr && <Typography color="error" variant="body2">{msgSearchErr}</Typography>}

                    <List dense>
                        {msgSearchResults.map((m) => (
                            <React.Fragment key={`sr-${m.id}`}>
                                <ListItem
                                    disableGutters
                                    secondaryAction={
                                        <Button size="small" onClick={() => {
                                            setMsgSearchOpen(false);
                                            if (!messagesRef.current.some(x => x.id === m.id)) {
                                                loadUntilFound(m.id);    // اگر در لیست نبود، تاریخچه را لود کن
                                            } else {
                                                scrollToMessage(m.id);   // اگر بود، اسکرول و هایلایت
                                            }
                                        }}>
                                            نمایش
                                        </Button>
                                    }
                                >
                                    <ListItemAvatar><Avatar>{(m.senderName || '#')[0]}</Avatar></ListItemAvatar>
                                    <ListItemText
                                        primary={<Typography noWrap fontWeight={700}>{m.senderName || `کاربر #${m.sender_id}`}</Typography>}
                                        secondary={<Typography variant="caption" color="text.secondary">{new Date(m.created_at).toLocaleString('fa-IR')}</Typography>}
                                    />
                                </ListItem>
                                {m.text && (
                                    <Box sx={{ px: 7, pb: 1, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {m.text}
                                    </Box>
                                )}
                                <Divider />
                            </React.Fragment>
                        ))}
                        {!msgSearchLoading && !msgSearchResults.length && !!msgSearchQ.trim() && (
                            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                                موردی یافت نشد.
                            </Typography>
                        )}
                    </List>

                    {!!msgSearchResults.length && (
                        <Box sx={{ textAlign: 'center', mt: 1 }}>
                            <Button onClick={() => doSearchMessages(false)}>نتایج بیشتر</Button>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setMsgSearchOpen(false)}>بستن</Button>
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
