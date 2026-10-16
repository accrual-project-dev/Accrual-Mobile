// ======================================================================
// TROUVAILLE SHARED LEDGER DETAIL SHEET
// Ultra-luxury Apple Monochrome Glassmorphism
// Multi-User Collaboration, Role Management, Invite Codes & Vector QR Code
// Strictly compliant with GEMINI.md: Vector Lucide icons only, zero native emojis,
// single unified scroll container, and 100% pure localization.
// ======================================================================

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  Copy,
  Check,
  Share2,
  RotateCcw,
  QrCode,
  Eye,
  Edit3,
  UserX,
  LogOut,
  Link,
  Loader2,
  Clock,
} from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { useSpace, type MoneySpace } from "../../contexts/SpaceContext";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useToast } from "../../contexts/ToastContext";
import { triggerHaptic, triggerSuccessHaptic } from "../../lib/haptics";
import {
  fetchLedgerMembers,
  approveLedgerMember,
  updateMemberRole,
  removeMemberFromLedger,
  regenerateInviteCode,
  generateInviteCode,
} from "../../lib/sharedLedgerService";
import { generateQrSvg, buildJoinLedgerUrl } from "../../lib/qrCodeGenerator";
import type { LedgerMember, LedgerMemberRole } from "../../types";

interface SharedLedgerDetailSheetProps {
  isOpen: boolean;
  ledger: MoneySpace | null;
  onClose: () => void;
  onEditLedger?: (ledger: MoneySpace) => void;
}

export function SharedLedgerDetailSheet({
  isOpen,
  ledger,
  onClose,
  onEditLedger,
}: SharedLedgerDetailSheetProps) {
  const { user } = useAuth();
  const { isIndonesian } = useLanguage();
  const { showToast } = useToast();
  const { spaces, leaveSharedSpace, updateCustomSpace, refreshLedgers } = useSpace();

  const [members, setMembers] = useState<LedgerMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [qrSvg, setQrSvg] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [confirmKickMember, setConfirmKickMember] = useState<LedgerMember | null>(null);

  // Always resolve the latest reactive space from SpaceContext so newly generated invite_code is never stale
  const liveLedger = useMemo(() => {
    if (!ledger) return null;
    return spaces.find((s) => s.id === ledger.id) || ledger;
  }, [spaces, ledger]);

  const liveLedgerId = liveLedger?.id || "";
  const userId = user?.id || "";
  const userEmail = user?.email || "";
  const userFullName = (user?.user_metadata?.full_name as string) || "";

  const isOwner = useMemo(() => {
    if (!liveLedger) return false;
    if (liveLedger.role === "owner") return true;
    if (userId && liveLedger.user_id === userId) return true;
    if (liveLedger.id === "personal") return true;
    return false;
  }, [liveLedger, userId]);

  const fallbackGeneratedCode = useMemo(() => generateInviteCode(), []);
  const inviteCode = liveLedger?.invite_code || fallbackGeneratedCode;
  const { webUrl } = useMemo(
    () => buildJoinLedgerUrl(inviteCode),
    [inviteCode],
  );

  // Persist generated code if shared ledger had no invite_code yet
  useEffect(() => {
    if (isOpen && liveLedgerId && !liveLedger?.invite_code && isOwner) {
      updateCustomSpace(liveLedgerId, { is_shared: true, invite_code: fallbackGeneratedCode });
    }
  }, [isOpen, liveLedgerId, liveLedger?.invite_code, isOwner, updateCustomSpace, fallbackGeneratedCode]);

  // Load members and QR code on open
  const loadData = useCallback(async () => {
    if (!liveLedgerId) return;
    setLoadingMembers(true);
    try {
      const list = await fetchLedgerMembers(liveLedgerId);
      if (isOwner && userId && !list.some((m) => m.user_id === userId)) {
        const ownerFallback: LedgerMember = {
          id: `owner-${userId}`,
          ledger_id: liveLedgerId,
          user_id: userId,
          role: "owner",
          status: "active",
          display_name:
            userFullName ||
            userEmail.split("@")[0] ||
            (isIndonesian ? "Pemilik" : "Owner"),
          email: userEmail || null,
          joined_at: new Date().toISOString(),
        };
        setMembers([ownerFallback, ...list]);
      } else {
        setMembers(list);
      }

      // Generate monochrome Apple SVG QR
      const svg = await generateQrSvg(webUrl, {
        margin: 1,
        darkColor: "#09090c",
        lightColor: "#ffffff",
      });
      setQrSvg(svg);
    } catch (err) {
      console.error("[SharedLedgerDetailSheet] Error loading data:", err);
    } finally {
      setLoadingMembers(false);
    }
  }, [liveLedgerId, webUrl, isOwner, userId, userFullName, userEmail, isIndonesian]);

  useEffect(() => {
    let active = true;
    if (isOpen && liveLedgerId) {
      void Promise.resolve().then(() => {
        if (!active) return;
        setCopiedCode(false);
        setCopiedLink(false);
        setConfirmLeaveOpen(false);
        setConfirmKickMember(null);
        void loadData();
      });
    }
    return () => {
      active = false;
    };
  }, [isOpen, liveLedgerId, inviteCode, loadData]);

  if (!liveLedger) return null;

  const handleCopyCode = async () => {
    triggerHaptic("light");
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopiedCode(true);
      showToast(
        isIndonesian ? "Kode undangan disalin ke papan klip!" : "Invite code copied to clipboard!",
        "add",
      );
      setTimeout(() => setCopiedCode(false), 2200);
    } catch {}
  };

  const handleCopyLink = async () => {
    triggerHaptic("light");
    try {
      await navigator.clipboard.writeText(webUrl);
      setCopiedLink(true);
      showToast(
        isIndonesian ? "Tautan undangan disalin!" : "Invite link copied!",
        "add",
      );
      setTimeout(() => setCopiedLink(false), 2200);
    } catch {}
  };

  const handleShare = async () => {
    triggerHaptic("medium");
    const shareText = isIndonesian
      ? `Ayo bergabung ke space bersama '${liveLedger.name}' di Accrual! Masukkan kode: ${inviteCode} atau buka: ${webUrl}`
      : `Join the shared space '${liveLedger.name}' on Accrual! Use code: ${inviteCode} or open: ${webUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Accrual - ${liveLedger.name}`,
          text: shareText,
          url: webUrl,
        });
      } catch {}
    } else {
      handleCopyLink();
    }
  };

  const handleRegenerateCode = async () => {
    if (!isOwner) return;
    triggerHaptic("medium");
    setIsRegenerating(true);
    try {
      const newCode = await regenerateInviteCode(liveLedger.id);
      if (newCode) {
        updateCustomSpace(liveLedger.id, { ...liveLedger, invite_code: newCode });
        await refreshLedgers();
        await loadData();
        triggerSuccessHaptic();
        showToast(
          isIndonesian ? "Kode undangan baru berhasil dibuat!" : "New invite code generated!",
          "add",
        );
      }
    } catch {
      showToast(isIndonesian ? "Gagal memperbarui kode." : "Failed to regenerate code.", "delete");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleApproveMember = async (targetMember: LedgerMember) => {
    if (!isOwner) return;
    triggerHaptic("medium");
    const success = await approveLedgerMember(liveLedger.id, targetMember.user_id);
    if (success) {
      triggerSuccessHaptic();
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === targetMember.user_id ? { ...m, status: "active" } : m,
        ),
      );
      showToast(
        isIndonesian
          ? `${targetMember.display_name || "Anggota"} telah disetujui!`
          : `${targetMember.display_name || "Member"} approved!`,
        "add",
      );
    }
  };

  const handleChangeRole = async (targetMember: LedgerMember, newRole: LedgerMemberRole) => {
    if (!isOwner) return;
    triggerHaptic("light");
    const success = await updateMemberRole(liveLedger.id, targetMember.user_id, newRole);
    if (success) {
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === targetMember.user_id ? { ...m, role: newRole } : m,
        ),
      );
      showToast(
        isIndonesian
          ? `Peran diubah menjadi ${newRole === "editor" ? "Pengelola" : "Pemantau"}`
          : `Role changed to ${newRole}`,
        "add",
      );
    }
  };

  const handleKickMember = async (targetMember: LedgerMember) => {
    if (!isOwner) return;
    triggerHaptic("heavy");
    const success = await removeMemberFromLedger(liveLedger.id, targetMember.user_id);
    if (success) {
      setMembers((prev) => prev.filter((m) => m.user_id !== targetMember.user_id));
      setConfirmKickMember(null);
      showToast(
        isIndonesian ? "Anggota telah dikeluarkan." : "Member removed.",
        "add",
      );
    }
  };

  const handleLeaveLedger = async () => {
    triggerHaptic("heavy");
    const success = await leaveSharedSpace(liveLedger.id);
    if (success) {
      triggerSuccessHaptic();
      showToast(
        isIndonesian ? "Berhasil keluar dari space bersama." : "Left shared space successfully.",
        "add",
      );
      onClose();
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="px-5 sm:px-6 space-y-6 pb-[max(calc(env(safe-area-inset-bottom,0px)+12px),24px)] select-none">
        
        {/* Header Capsule */}
        <div className="text-center pt-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--glass-fill)] border border-[var(--glass-border)] text-[11px] font-semibold text-[var(--text-secondary)] mb-2">
            <Users size={12} strokeWidth={2} />
            <span>{isIndonesian ? "Space Bersama" : "Shared Collaborative Space"}</span>
          </div>
          <h2 className="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">
            {liveLedger.name}
          </h2>
          <p className="text-[12px] text-[var(--text-tertiary)] mt-1 max-w-xs mx-auto leading-relaxed">
            {liveLedger.description || (isIndonesian ? "Kelola keuangan dan mutasi kas bersama secara transparan." : "Manage cashflow and expenses together transparently.")}
          </p>
        </div>

        {/* Invite Code & Share Card */}
        <div
          className="rounded-3xl p-5 border relative overflow-hidden space-y-4"
          style={{
            background: "var(--glass-fill)",
            borderColor: "var(--glass-border)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              {isIndonesian ? "KODE UNDANGAN" : "INVITE CODE"}
            </span>
            {isOwner && (
              <button
                type="button"
                onClick={handleRegenerateCode}
                disabled={isRegenerating}
                className="text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                title={isIndonesian ? "Acak Ulang Kode" : "Regenerate Code"}
              >
                <RotateCcw size={11} className={isRegenerating ? "animate-spin" : ""} />
                <span>{isIndonesian ? "Acak Ulang" : "Regenerate"}</span>
              </button>
            )}
          </div>

          {/* Large Alphanumeric Code Display */}
          <div
            onClick={handleCopyCode}
            className="p-3.5 rounded-2xl border text-center cursor-pointer active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            style={{
              background: "var(--bg-elevated)",
              borderColor: "var(--glass-border)",
            }}
          >
            <span className="text-[24px] font-semibold tracking-widest text-[var(--text-primary)]">
              {inviteCode}
            </span>
            <div className="w-8 h-8 rounded-full bg-[var(--glass-fill)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] shrink-0">
              {copiedCode ? <Check size={14} strokeWidth={2.5} /> : <Copy size={14} strokeWidth={1.75} />}
            </div>
          </div>

          {/* Action Pills */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopyLink}
              className="py-2.5 px-3 rounded-2xl text-[12px] font-semibold border border-[var(--glass-border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              {copiedLink ? <Check size={13} strokeWidth={2.5} /> : <Link size={13} strokeWidth={1.75} />}
              <span>{copiedLink ? (isIndonesian ? "Tersalin!" : "Copied!") : (isIndonesian ? "Salin Tautan" : "Copy Link")}</span>
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="py-2.5 px-3 rounded-2xl text-[12px] font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-md"
            >
              <Share2 size={13} strokeWidth={2} />
              <span>{isIndonesian ? "Bagikan" : "Share"}</span>
            </button>
          </div>
        </div>

        {/* Monochrome Apple Luxury QR Code Card */}
        <div
          className="rounded-3xl p-5 border text-center space-y-3"
          style={{
            background: "var(--glass-fill)",
            borderColor: "var(--glass-border)",
          }}
        >
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            <QrCode size={13} strokeWidth={1.75} />
            <span>{isIndonesian ? "Pindai Kode QR Antar-Layar (Otomatis Setuju)" : "Scan Cross-Device QR (Auto-Approve)"}</span>
          </div>

          {/* High-Contrast Crisp SVG QR */}
          <div className="w-48 h-48 mx-auto p-3 rounded-2xl bg-white shadow-xl border border-black/10 flex items-center justify-center overflow-hidden">
            {qrSvg ? (
              <div
                className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <Loader2 className="animate-spin text-black/40" size={24} />
            )}
          </div>
          <p className="text-[11px] text-[var(--text-tertiary)]">
            {isIndonesian
              ? "Anggota yang memindai QR langsung aktif otomatis. Anggota via kode teks memerlukan persetujuan Anda."
              : "Members scanning QR join immediately. Members entering text code require your approval."}
          </p>
        </div>

        {/* Member Management List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              {isIndonesian ? `ANGGOTA (${members.length})` : `MEMBERS (${members.length})`}
            </span>
            <span className="text-[11px] text-[var(--text-tertiary)]">
              {isIndonesian ? "Hak Akses" : "Access Level"}
            </span>
          </div>

          <div
            className="rounded-3xl border divide-y divide-[var(--glass-border)] overflow-hidden transition-colors"
            style={{
              background: "var(--glass-fill)",
              borderColor: "var(--glass-border)",
            }}
          >
            {loadingMembers && members.length === 0 ? (
              <div className="p-6 text-center text-[12px] text-[var(--text-tertiary)] flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                <span>{isIndonesian ? "Memuat anggota..." : "Loading members..."}</span>
              </div>
            ) : members.length === 0 ? (
              <div className="p-4 text-center text-[12px] text-[var(--text-tertiary)]">
                {isIndonesian ? "Belum ada anggota lain yang bergabung." : "No other members have joined yet."}
              </div>
            ) : (
              members.map((member) => {
                const isMe = member.user_id === user?.id;
                const isPending = member.status === "pending";
                const memberInitials = (member.display_name || member.email || "User")
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <div
                    key={member.id || member.user_id}
                    className="p-3.5 flex items-center justify-between gap-3"
                  >
                    {/* Avatar & Name */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-[var(--bg-elevated)] border border-[var(--glass-border)] text-[var(--text-primary)] font-semibold text-[11px] flex items-center justify-center shrink-0">
                        {memberInitials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                            {member.display_name || member.email?.split("@")[0] || "Anggota"}
                          </p>
                          {isMe && (
                            <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-[var(--bg-elevated)] text-[var(--text-tertiary)] border border-[var(--glass-border)]">
                              {isIndonesian ? "Saya" : "You"}
                            </span>
                          )}
                          {isPending && (
                            <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--glass-border)] inline-flex items-center gap-1">
                              <Clock size={9} strokeWidth={2} />
                              <span>{isIndonesian ? "Menunggu" : "Pending"}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--text-tertiary)] truncate">
                          {isPending
                            ? isIndonesian
                              ? "Menunggu persetujuan pemilik space"
                              : "Awaiting space owner approval"
                            : member.email || (isIndonesian ? "Terhubung" : "Connected")}
                        </p>
                      </div>
                    </div>

                    {/* Role Badge / Control */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isOwner && !isMe ? (
                        isPending ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleApproveMember(member)}
                              className="px-3 py-1 rounded-full text-[11px] font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm"
                            >
                              <Check size={11} strokeWidth={2.5} />
                              <span>{isIndonesian ? "Setujui" : "Approve"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmKickMember(member)}
                              className="w-7 h-7 rounded-full border border-[var(--glass-border)] bg-[var(--bg-elevated)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
                              title={isIndonesian ? "Tolak Permintaan" : "Decline Request"}
                            >
                              <UserX size={13} strokeWidth={1.75} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {/* Role Toggle Button */}
                            <button
                              type="button"
                              onClick={() =>
                                handleChangeRole(
                                  member,
                                  member.role === "editor" ? "viewer" : "editor",
                                )
                              }
                              className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[var(--glass-border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] flex items-center gap-1 cursor-pointer transition-colors active:scale-95"
                            >
                              {member.role === "editor" ? (
                                <>
                                  <Edit3 size={10} strokeWidth={2} />
                                  <span>{isIndonesian ? "Pengelola" : "Editor"}</span>
                                </>
                              ) : (
                                <>
                                  <Eye size={10} strokeWidth={2} />
                                  <span>{isIndonesian ? "Pemantau" : "Viewer"}</span>
                                </>
                              )}
                            </button>

                            {/* Kick Button */}
                            <button
                              type="button"
                              onClick={() => setConfirmKickMember(member)}
                              className="w-7 h-7 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
                              title={isIndonesian ? "Keluarkan Anggota" : "Remove Member"}
                            >
                              <UserX size={13} strokeWidth={1.75} />
                            </button>
                          </div>
                        )
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[var(--glass-border)] bg-[var(--bg-elevated)] text-[var(--text-tertiary)]">
                          {isPending
                            ? isIndonesian
                              ? "Menunggu"
                              : "Pending"
                            : member.role === "owner"
                              ? isIndonesian
                                ? "Pemilik"
                                : "Owner"
                              : member.role === "editor"
                                ? isIndonesian
                                  ? "Pengelola"
                                  : "Editor"
                                : isIndonesian
                                  ? "Pemantau"
                                  : "Viewer"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Actions: Leave or Edit */}
        <div className="pt-2 space-y-2">
          {onEditLedger && isOwner && (
            <button
              type="button"
              onClick={() => onEditLedger(liveLedger)}
              className="w-full py-3 px-4 rounded-2xl text-[13px] font-semibold border border-[var(--glass-border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <Edit3 size={14} strokeWidth={1.75} />
              <span>{isIndonesian ? "Ubah Nama & Ikon Space" : "Edit Space Name & Icon"}</span>
            </button>
          )}

          {!isOwner ? (
            <button
              type="button"
              onClick={() => setConfirmLeaveOpen(true)}
              className="w-full py-3 px-4 rounded-2xl text-[13px] font-semibold border border-[var(--glass-border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <LogOut size={14} strokeWidth={1.75} />
              <span>{isIndonesian ? "Keluar dari Space Bersama" : "Leave Shared Space"}</span>
            </button>
          ) : null}
        </div>

        {/* Kick Member Confirmation Dialog */}
        {confirmKickMember && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div
              className="w-full max-w-xs rounded-3xl p-5 border space-y-4 shadow-2xl"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--glass-border)",
              }}
            >
              <h4 className="text-[15px] font-semibold text-[var(--text-primary)]">
                {isIndonesian ? "Keluarkan Anggota?" : "Remove Member?"}
              </h4>
              <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">
                {isIndonesian
                  ? `Apakah Anda yakin ingin mengeluarkan ${confirmKickMember.display_name || confirmKickMember.email} dari space ini?`
                  : `Are you sure you want to remove ${confirmKickMember.display_name || confirmKickMember.email} from this space?`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmKickMember(null)}
                  className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold border border-[var(--glass-border)] text-[var(--text-secondary)]"
                >
                  {isIndonesian ? "Batal" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={() => handleKickMember(confirmKickMember)}
                  className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)]"
                >
                  {isIndonesian ? "Keluarkan" : "Remove"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Leave Ledger Confirmation Dialog */}
        {confirmLeaveOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div
              className="w-full max-w-xs rounded-3xl p-5 border space-y-4 shadow-2xl"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--glass-border)",
              }}
            >
              <h4 className="text-[15px] font-semibold text-[var(--text-primary)]">
                {isIndonesian ? "Keluar dari Space Bersama?" : "Leave Shared Space?"}
              </h4>
              <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">
                {isIndonesian
                  ? "Anda tidak akan dapat lagi melihat atau mencatat pengeluaran di space bersama ini kecuali diundang kembali."
                  : "You will no longer be able to view or record transactions in this shared space unless invited again."}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmLeaveOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold border border-[var(--glass-border)] text-[var(--text-secondary)]"
                >
                  {isIndonesian ? "Batal" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={handleLeaveLedger}
                  className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)]"
                >
                  {isIndonesian ? "Keluar" : "Leave"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </BottomSheet>
  );
}
