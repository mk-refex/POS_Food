import React from 'react';

export default function Footer() {
  return (
    <footer className="w-full pt-3 mt-5 text-center">
      <div className="max-w-screen-md mx-auto text-sm text-gray-600">
        Powered by Refex AI Team © {new Date().getFullYear()}
      </div>
    </footer>
  );
}

