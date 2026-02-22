import { cn } from "../../lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

// Chat message skeleton
function MessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className={`flex-1 space-y-2 ${isUser ? 'items-end' : ''}`}>
        <Skeleton className={`h-4 ${isUser ? 'w-24 ml-auto' : 'w-32'}`} />
        <div className="space-y-1.5">
          <Skeleton className={`h-3 ${isUser ? 'w-48 ml-auto' : 'w-full max-w-md'}`} />
          <Skeleton className={`h-3 ${isUser ? 'w-32 ml-auto' : 'w-3/4 max-w-sm'}`} />
          {!isUser && <Skeleton className="h-3 w-1/2 max-w-xs" />}
        </div>
      </div>
    </div>
  )
}

// Chat loading skeleton (multiple messages)
function ChatSkeleton() {
  return (
    <div className="space-y-6 p-4">
      <MessageSkeleton isUser />
      <MessageSkeleton />
      <MessageSkeleton isUser />
      <MessageSkeleton />
    </div>
  )
}

// Conversation list item skeleton
function ConversationItemSkeleton() {
  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-12" />
      </div>
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}

// Sidebar skeleton
function SidebarSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <ConversationItemSkeleton key={i} />
      ))}
    </div>
  )
}

// Model selector skeleton
function ModelSelectorSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

// Image grid skeleton
function ImageGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="aspect-square rounded-lg" />
      ))}
    </div>
  )
}

// Stats skeleton
function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 p-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-12" />
        </div>
      ))}
    </div>
  )
}

// Document card skeleton
function DocumentCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-8 w-8 rounded-md flex-shrink-0" />
    </div>
  )
}

// Full page loading skeleton
function PageSkeleton() {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-80 border-r border-border p-4 space-y-4">
        <Skeleton className="h-10 w-full" />
        <SidebarSkeleton />
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-14 border-b border-border px-4 flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
        
        {/* Chat area */}
        <div className="flex-1 overflow-hidden">
          <ChatSkeleton />
        </div>
        
        {/* Input */}
        <div className="p-4 border-t border-border">
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export {
  Skeleton,
  MessageSkeleton,
  ChatSkeleton,
  ConversationItemSkeleton,
  SidebarSkeleton,
  ModelSelectorSkeleton,
  ImageGridSkeleton,
  DocumentCardSkeleton,
  StatsSkeleton,
  PageSkeleton
}

