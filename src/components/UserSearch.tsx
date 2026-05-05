"use client";

import { useState, useEffect, useRef } from "react";
import { searchUsers, ApiError } from "@/lib/api";
import type { PublicUser } from "@/lib/types";

interface UserSearchProps {
  token: string;
  currentUserId: string;
  onSelectUser: (user: PublicUser) => void;
}

export function UserSearch({ token, currentUserId, onSelectUser }: UserSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      setError(null);
      return;
    }

    setIsSearching(true);
    setError(null);

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchUsers(token, trimmed);
        setResults(data.filter((u) => u.id !== currentUserId));
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : "Search failed.");
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, token, currentUserId]);

  const handleSelect = (user: PublicUser) => {
    onSelectUser(user);
    setQuery("");
    setResults([]);
  };

  return (
    <div className="flex flex-col">
      {/* Search input */}
      <div className="px-3 py-2">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8696A0] pointer-events-none"
            viewBox="0 0 24 24" fill="none" aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
            <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            id="user-search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or start new chat"
            aria-label="Search for users"
            className="w-full bg-[#2A3942] border-none rounded-lg py-2 pl-9 pr-3 text-sm text-[#E9EDEF] placeholder:text-[#8696A0] focus:outline-none focus:ring-1 focus:ring-[#25D366]/40 transition-colors"
          />
          {isSearching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-[#25D366] border-t-transparent animate-spin" aria-hidden="true" />
          )}
        </div>
      </div>

      {/* Results */}
      {query.trim().length >= 2 && (
        <div className="flex flex-col">
          {error && (
            <p className="px-4 py-2 text-xs text-[#ef4444]">{error}</p>
          )}

          {!isSearching && !error && results.length === 0 && (
            <p className="px-4 py-3 text-xs text-[#8696A0]">
              No users found for &ldquo;{query}&rdquo;
            </p>
          )}

          {results.map((user) => (
            <button
              key={user.id}
              onClick={() => handleSelect(user)}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#2A3942]/60 transition-colors text-left"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-[#2A3942] flex items-center justify-center text-[#E9EDEF] font-semibold text-base shrink-0">
                {user.display_name.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#E9EDEF] truncate">{user.display_name}</p>
                <p className="text-xs text-[#8696A0]">@{user.username}</p>
              </div>

              <span className="text-xs text-[#25D366] shrink-0">
                Chat →
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
