"use client";

import React from 'react';
import { DocumentManager } from '@/components/documents/DocumentManager';

export default function DocumentsPage() {
  return (
    <div className="flex flex-col h-full p-4 md:p-6 max-w-4xl mx-auto">
      <DocumentManager />
    </div>
  );
}
