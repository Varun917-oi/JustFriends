"use client";

import { useState } from "react";

import { loginAction } from "@/app/actions";

export function LoginForm({ hasError = false }: { hasError?: boolean }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form className="login-form" action={loginAction}>
      {hasError ? <p className="form-error" role="alert">That username and password didn’t match. Try again.</p> : null}
      <label>
        <span>Your name</span>
        <input autoComplete="username" name="username" required placeholder="Username" />
      </label>
      <label>
        <span>Password</span>
        <span className="password-wrap">
          <input
            autoComplete="current-password"
            name="password"
            required
            type={showPassword ? "text" : "password"}
            placeholder="Your password"
          />
          <button
            type="button"
            className="password-toggle"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </span>
      </label>
      <button className="button button-primary button-full" type="submit">Come on in <span aria-hidden="true">↗</span></button>
      <p className="form-footnote">This little space is just for the two of you.</p>
    </form>
  );
}
