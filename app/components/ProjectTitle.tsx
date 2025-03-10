import * as Popover from '@radix-ui/react-popover';
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Check, Pencil } from "lucide-react";
import { useState } from "react";
import { useSubmit } from "@remix-run/react";

interface ProjectTitleProps {
  title: string;
}

export function ProjectTitle({ title }: ProjectTitleProps) {
  const [editTitle, setEditTitle] = useState(title);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const submit = useSubmit();

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditTitle(e.target.value);
  };

  const handleUpdateTitle = () => {
    const formData = new FormData();
    formData.append("title", editTitle);
    submit(formData, { method: "post" });
    setIsPopoverOpen(false);
  };

  return (
    <div className="flex h-[54px] items-center justify-center border-b pb-2">
      <h3 className="text-sm font-medium text-white">
        {title}
      </h3>
      <Popover.Root open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <Popover.Trigger asChild>
          <button className="ml-2 rounded p-1 text-white hover:bg-gray-800">
            <Pencil className="h-4 w-4" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="z-50 w-[300px] rounded-md border border-gray-700 bg-[#171717] p-2 shadow-lg" sideOffset={5}>
            <div className="flex items-center gap-2">
              <Input
                value={editTitle}
                onChange={handleTitleChange}
                className="flex-1 bg-[#1F2122] text-white min-w-[200px]"
              />
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 text-white hover:bg-gray-800"
                onClick={handleUpdateTitle}
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
} 