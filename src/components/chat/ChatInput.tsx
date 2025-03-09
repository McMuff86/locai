import React, { useState, useRef } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ChatInputProps } from "../../types/chat";
import { motion } from "framer-motion";
import { Send, Image, X } from "lucide-react";

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((message.trim() || selectedImages.length > 0) && !disabled) {
      onSend(message, selectedImages);
      setMessage("");
      setSelectedImages([]);
      setImagePreviews([]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedImages(prev => [...prev, ...newFiles]);
      
      // Create image previews
      newFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            setImagePreviews(prev => [...prev, e.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
      
      // Clear the input value so the same file can be selected again
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <motion.div
      className="sticky bottom-0 w-full p-4 bg-background border-t"
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Image previews */}
      {imagePreviews.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 max-w-4xl mx-auto">
          {imagePreviews.map((preview, index) => (
            <div key={index} className="relative inline-block">
              <img 
                src={preview} 
                alt={`Preview ${index}`} 
                className="h-20 w-20 object-cover rounded border" 
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl mx-auto">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter message or upload an image..."
          disabled={disabled}
          className="flex-grow"
        />
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
          multiple
        />
        <Button 
          type="button" 
          variant="outline" 
          disabled={disabled}
          onClick={triggerFileInput}
          title="Upload image"
        >
          <Image className="h-4 w-4" />
        </Button>
        <Button 
          type="submit" 
          disabled={disabled || (!message.trim() && selectedImages.length === 0)}
        >
          <Send className="h-4 w-4 mr-2" />
          Send
        </Button>
      </form>
    </motion.div>
  );
} 