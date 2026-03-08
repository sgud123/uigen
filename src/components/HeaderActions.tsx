"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, LogOut, FolderOpen, ChevronDown, Menu, LogIn, UserPlus } from "lucide-react";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { signOut } from "@/actions";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";

interface HeaderActionsProps {
  user?: {
    id: string;
    email: string;
  } | null;
  projectId?: string;
}

interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export function HeaderActions({ user, projectId }: HeaderActionsProps) {
  const router = useRouter();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [menuOpen, setMenuOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Load projects initially
  useEffect(() => {
    if (user && projectId) {
      getProjects()
        .then(setProjects)
        .catch(console.error)
        .finally(() => setInitialLoading(false));
    }
  }, [user, projectId]);

  // Refresh projects when popover opens
  useEffect(() => {
    if (user && projectsOpen) {
      getProjects().then(setProjects).catch(console.error);
    }
  }, [projectsOpen, user]);

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentProject = projects.find((p) => p.id === projectId);

  const handleSignInClick = () => {
    setAuthMode("signin");
    setAuthDialogOpen(true);
  };

  const handleSignUpClick = () => {
    setAuthMode("signup");
    setAuthDialogOpen(true);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleNewDesign = async () => {
    const project = await createProject({
      name: `Design #${~~(Math.random() * 100000)}`,
      messages: [],
      data: {},
    });
    router.push(`/${project.id}`);
  };

  if (!user) {
    return (
      <>
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Menu className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="end">
            <button
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-neutral-100 transition-colors"
              onClick={() => { handleSignInClick(); setMenuOpen(false); }}
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </button>
            <button
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-neutral-100 transition-colors"
              onClick={() => { handleSignUpClick(); setMenuOpen(false); }}
            >
              <UserPlus className="h-4 w-4" />
              Sign Up
            </button>
          </PopoverContent>
        </Popover>
        <AuthDialog
          open={authDialogOpen}
          onOpenChange={setAuthDialogOpen}
          defaultMode={authMode}
        />
      </>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Menu className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="end">
          {/* Project picker */}
          {!initialLoading && (
            <>
              <Popover open={projectsOpen} onOpenChange={setProjectsOpen}>
                <PopoverTrigger asChild>
                  <button className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-neutral-100 transition-colors">
                    <FolderOpen className="h-4 w-4 shrink-0" />
                    <span className="truncate flex-1 text-left">
                      {currentProject ? currentProject.name : "Select Project"}
                    </span>
                    <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="end">
                  <Command>
                    <CommandInput
                      placeholder="Search projects..."
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>No projects found.</CommandEmpty>
                      <CommandGroup>
                        {filteredProjects.map((project) => (
                          <CommandItem
                            key={project.id}
                            value={project.name}
                            onSelect={() => {
                              router.push(`/${project.id}`);
                              setProjectsOpen(false);
                              setMenuOpen(false);
                              setSearchQuery("");
                            }}
                          >
                            <span className="font-medium">{project.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Separator className="my-1" />
            </>
          )}

          {/* New Design */}
          <button
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-neutral-100 transition-colors"
            onClick={() => { handleNewDesign(); setMenuOpen(false); }}
          >
            <Plus className="h-4 w-4" />
            New Design
          </button>

          <Separator className="my-1" />

          {/* Sign out */}
          <button
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            onClick={() => { handleSignOut(); setMenuOpen(false); }}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
