import { connection } from "next/server";
import { redirect } from "next/navigation";

import { AdminNav, SiteNav } from "@/components/site";
import { changePasswordAction, updateSiteSettingsAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { readSiteSettings } from "@/lib/data";

export const instant = false;

export default async function SettingsPage({ searchParams }: {
  searchParams: Promise<{ saved?: string; error?: string; password?: string; passwordError?: string }>;
}) {
  await connection();
  const [user, settings, query] = await Promise.all([getCurrentUser(), readSiteSettings(), searchParams]);
  if (user?.role !== "admin") redirect("/login");

  return (
    <main className="admin-page">
      <SiteNav user={user} />
      <div className="admin-layout">
        <AdminNav active="settings" />
        <section className="admin-main settings-main">
          <div className="admin-welcome"><div><p className="eyebrow">TUNE THE LITTLE DETAILS</p><h1>Story settings</h1><p>Make the welcome and the last word your own.</p></div></div>
          {query.saved ? <p className="success-note" role="status">Your settings have been saved.</p> : null}
          {query.error ? <p className="form-error" role="alert">Some settings are longer than allowed. Please shorten them and save again.</p> : null}
          <form className="settings-form" action={updateSiteSettingsAction}>
            <label><span>Universe title</span><input name="title" maxLength={100} required defaultValue={settings.title} /></label>
            <label><span>Opening line</span><input name="subtitle" maxLength={180} required defaultValue={settings.subtitle} /></label>
            <label><span>Closing letter</span><textarea name="closingLetter" rows={5} required defaultValue={settings.closingLetter} /></label>
            <button className="button button-primary" type="submit">Save story settings <span aria-hidden="true">↗</span></button>
          </form>
          <section className="security-note">
            <p className="eyebrow">ACCOUNT & SECURITY</p>
            <h2>Both accounts share the studio.</h2>
            <p>Varun and Akrati have identical administrator permissions. Password changes below apply only to the account currently signed in.</p>
            <p>Signed in as <strong>{user.username}</strong>.</p>
          </section>
          {query.password === "updated" ? <p className="success-note" role="status">Your password has been changed. Your other admin account was not affected.</p> : null}
          {query.passwordError ? (
            <p className="form-error" role="alert">
              {query.passwordError === "weak"
                ? "Choose a new password between 12 and 256 characters."
                : query.passwordError === "mismatch"
                  ? "The new password and confirmation do not match."
                  : "The current password could not be verified."}
            </p>
          ) : null}
          <form className="settings-form password-settings-form" action={changePasswordAction}>
            <p className="eyebrow">CHANGE YOUR PASSWORD</p>
            <label><span>Current password</span><input name="currentPassword" type="password" autoComplete="current-password" maxLength={256} required /></label>
            <label><span>New password <small>12–256 characters</small></span><input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></label>
            <label><span>Confirm new password</span><input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></label>
            <button className="button button-primary" type="submit">Change my password <span aria-hidden="true">↗</span></button>
          </form>
        </section>
      </div>
    </main>
  );
}
