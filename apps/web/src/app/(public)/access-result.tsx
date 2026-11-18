"use client";

import { useEffect, useRef } from "react";
import { CircleCheck, Mail } from "lucide-react";
import Link from "next/link";
import { AccessSheet } from "./access-sheet";
import styles from "./public-origami.module.css";

export function AccessResult({
  title,
  message,
  action,
  email = false,
}: {
  title: string;
  message: string;
  action: string;
  email?: boolean;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const Icon = email ? Mail : CircleCheck;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <AccessSheet>
      <div
        className={`origami-state ${email ? "" : "origami-state--success"} ${styles.result}`}
      >
        <Icon aria-hidden="true" />
        <h1
          className="origami-page-title"
          tabIndex={-1}
          ref={titleRef}
          aria-describedby="access-result-message"
        >
          {title}
        </h1>
        <p id="access-result-message">{message}</p>
      </div>
      <Link href="/login" className="origami-button">
        {action}
      </Link>
    </AccessSheet>
  );
}
