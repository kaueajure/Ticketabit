"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Camera, Check, KeyRound, Mail, Moon, Palette, Sun, Trash2, UserRound } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { useApp } from "@/components/providers/app-provider";
import { Avatar } from "@/components/ui/avatar";

async function responseError(response: Response, fallback: string) {
  const result = await response.json().catch(() => null) as { error?: string } | null;
  return result?.error ?? fallback;
}

export function AccountView() {
  const { currentUser, reloadData, showNotice, theme, changeTheme } = useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(currentUser?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileError, setProfileError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);

  useEffect(() => setName(currentUser?.name ?? ""), [currentUser?.name]);

  if (!currentUser) return null;

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setProfileError("");
    setSavingProfile(true);
    const response = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSavingProfile(false);
    if (!response.ok) {
      setProfileError(await responseError(response, "Não foi possível salvar o nome."));
      return;
    }
    await reloadData();
    showNotice("Nome atualizado");
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError("");
    if (newPassword !== confirmPassword) {
      setPasswordError("A confirmação não corresponde à nova senha.");
      return;
    }
    setSavingPassword(true);
    const response = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setSavingPassword(false);
    if (!response.ok) {
      setPasswordError(await responseError(response, "Não foi possível alterar a senha."));
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    showNotice("Senha alterada com segurança");
  };

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const photo = event.target.files?.[0];
    event.target.value = "";
    if (!photo) return;
    setPhotoError("");
    setSavingPhoto(true);
    const formData = new FormData();
    formData.append("photo", photo);
    const response = await fetch("/api/account/photo", { method: "POST", body: formData });
    setSavingPhoto(false);
    if (!response.ok) {
      setPhotoError(await responseError(response, "Não foi possível salvar a foto."));
      return;
    }
    await reloadData();
    showNotice("Foto atualizada");
  };

  const removePhoto = async () => {
    setPhotoError("");
    setSavingPhoto(true);
    const response = await fetch("/api/account/photo", { method: "DELETE" });
    setSavingPhoto(false);
    if (!response.ok) {
      setPhotoError(await responseError(response, "Não foi possível remover a foto."));
      return;
    }
    await reloadData();
    showNotice("Foto removida");
  };

  const selectTheme = async (nextTheme: "light" | "dark") => {
    if (nextTheme === theme || savingTheme) return;
    setSavingTheme(true);
    await changeTheme(nextTheme);
    setSavingTheme(false);
  };

  return (
    <div className="page account-page">
      <PageHeader eyebrow="CONTA" title="Configurações da conta" description="Gerencie suas informações pessoais, aparência e segurança." />
      <div className="account-layout">
        <aside className="account-profile-card">
          <div className="account-photo">
            <Avatar name={currentUser.name} photoUrl={currentUser.avatarUrl} size="xl" />
            <button type="button" onClick={() => fileInput.current?.click()} aria-label="Alterar foto"><Camera size={16} /></button>
          </div>
          <h2>{currentUser.name}</h2>
          <p>{currentUser.email}</p>
          <input ref={fileInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} />
          <div className="account-photo-actions">
            <button type="button" className="secondary-button" disabled={savingPhoto} onClick={() => fileInput.current?.click()}><Camera size={15} />{savingPhoto ? "Salvando..." : "Alterar foto"}</button>
            {currentUser.avatarUrl && <button type="button" className="account-remove-photo" disabled={savingPhoto} onClick={() => void removePhoto()}><Trash2 size={14} />Remover</button>}
          </div>
          <small>JPG, PNG ou WebP. Tamanho máximo de 2 MB.</small>
          {photoError && <p className="form-error">{photoError}</p>}
        </aside>

        <div className="account-sections">
          <form className="account-section" onSubmit={saveProfile}>
            <div className="account-section-heading"><span><UserRound size={17} /></span><div><h2>Informações pessoais</h2><p>Esses dados identificam você no sistema.</p></div></div>
            <div className="account-form-grid">
              <label className="form-field"><span>Nome de usuário</span><input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
              <label className="form-field"><span>E-mail</span><span className="input-with-icon"><Mail size={15} /><input value={currentUser.email} disabled /></span><small>O e-mail de acesso é gerenciado pelo administrador.</small></label>
            </div>
            {profileError && <p className="form-error account-form-error">{profileError}</p>}
            <footer><button className="primary-button" disabled={savingProfile || name.trim() === currentUser.name}>{savingProfile ? "Salvando..." : "Salvar alterações"}</button></footer>
          </form>

          <section className="account-section account-theme-section">
            <div className="account-section-heading"><span><Palette size={17} /></span><div><h2>Aparência</h2><p>Escolha como o Ticketabit será exibido para sua conta.</p></div></div>
            <div className="theme-choice-grid">
              <button type="button" className={`theme-choice ${theme === "light" ? "active" : ""}`} onClick={() => void selectTheme("light")} disabled={savingTheme} aria-pressed={theme === "light"}>
                <span className="theme-choice-preview light"><i/><i/><i/></span>
                <span className="theme-choice-copy"><Sun size={16}/><span><strong>Claro</strong><small>Interface clara e suave</small></span></span>
                {theme === "light" && <Check size={15} className="theme-choice-check"/>}
              </button>
              <button type="button" className={`theme-choice ${theme === "dark" ? "active" : ""}`} onClick={() => void selectTheme("dark")} disabled={savingTheme} aria-pressed={theme === "dark"}>
                <span className="theme-choice-preview dark"><i/><i/><i/></span>
                <span className="theme-choice-copy"><Moon size={16}/><span><strong>Escuro</strong><small>Menos brilho em ambientes escuros</small></span></span>
                {theme === "dark" && <Check size={15} className="theme-choice-check"/>}
              </button>
            </div>
            <footer><span className="theme-save-copy">{savingTheme ? "Salvando preferência..." : "O tema é aplicado imediatamente em todas as páginas."}</span></footer>
          </section>

          <form className="account-section" onSubmit={changePassword}>
            <div className="account-section-heading"><span><KeyRound size={17} /></span><div><h2>Alterar senha</h2><p>Confirme sua senha atual antes de definir uma nova.</p></div></div>
            <div className="account-form-grid password-grid">
              <label className="form-field form-field-full"><span>Senha atual</span><input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
              <label className="form-field"><span>Nova senha</span><input required minLength={6} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><small>Mínimo de 6 caracteres.</small></label>
              <label className="form-field"><span>Confirmar nova senha</span><input required minLength={6} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
            </div>
            {passwordError && <p className="form-error account-form-error">{passwordError}</p>}
            <footer><button className="primary-button" disabled={savingPassword}>{savingPassword ? "Alterando..." : "Alterar senha"}</button></footer>
          </form>
        </div>
      </div>
    </div>
  );
}
