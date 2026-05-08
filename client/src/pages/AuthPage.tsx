import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { z } from "zod";
import contempoLogo from "@/assets/contempo_wordmark_v1_white.png";

// List of predefined users
const predefinedUsers = [
  "Brandon Bayer",
  "Cristy Aguilar",
  "Edward Maldonaldo",
  "Karen Scott",
  "Leticia Piña",
  "Luis Piña",
  "Lulu Arnold",
  "Marco Bisnar",
  "Mark Haloossim",
  "Matthew Green",
  "Matt Mark",
  "Richard Garcia",
  "Ruben Rodriguez",
  "Shaneen Gottula"
].sort(); // Ensure alphabetical order

// Map of display names to usernames - must match server side implementation
const usernameMappings: Record<string, string> = {
  "Brandon Bayer": "brandonbayer",
  "Cristy Aguilar": "cristyaguilar",
  "Edward Maldonaldo": "edwardmaldonaldo",
  "Karen Scott": "karenscott",
  "Leticia Piña": "leticiapina",
  "Luis Piña": "luispina",
  "Lulu Arnold": "luluarnold",
  "Marco Bisnar": "marcobisnar",
  "Mark Haloossim": "markhaloossim",
  "Matthew Green": "matthewgreen",
  "Matt Mark": "mattmark",
  "Richard Garcia": "richardgarcia",
  "Ruben Rodriguez": "rubenrodriguez",
  "Shaneen Gottula": "shaneengottula"
};

// Schema for user selection
const userSelectionSchema = z.object({
  username: z.string().min(1, "Please select a user")
});

export default function AuthPage() {
  const { user, loginMutation, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [isSelectingUser, setIsSelectingUser] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  // User selection form
  const userForm = useForm<z.infer<typeof userSelectionSchema>>({
    resolver: zodResolver(userSelectionSchema),
    defaultValues: {
      username: ""
    }
  });

  // Handle user selection
  const onUserSelect = (values: z.infer<typeof userSelectionSchema>) => {
    setIsSelectingUser(true);
    
    // Get the username from our mapping, which matches the server-side implementation
    const selectedDisplayName = values.username;
    const username = usernameMappings[selectedDisplayName];
    
    if (!username) {
      console.error(`No username found for display name: ${selectedDisplayName}`);
      setIsSelectingUser(false);
      return;
    }
    
    // Login without password
    loginMutation.mutate(
      { 
        username,
        noPasswordLogin: true // Signal to use passwordless login 
      },
      {
        onSettled: () => {
          setIsSelectingUser(false);
        }
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1d4ed8]">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--app-bg)' }}>
      {/* Blue header */}
      <div className="bg-[#1d4ed8] px-6 pt-12 pb-10 flex flex-col items-center" style={{ boxShadow: '0 1px 4px rgba(0,0,0,.18)' }}>
        <img
          src={contempoLogo}
          alt="Contempo Logo"
          className="h-10 mb-4"
        />
        <p className="text-white/70 text-sm">Sepulveda Showroom · Product Catalog</p>
      </div>

      {/* Form card */}
      <div className="flex-grow flex items-start justify-center px-4 pt-8">
        <div className="w-full max-w-sm bg-white rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <h2 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Sign In</h2>
          </div>
          <div className="p-5">
            <Form {...userForm}>
              <form onSubmit={userForm.handleSubmit(onUserSelect)} className="space-y-5">
                <FormField
                  control={userForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium" style={{ color: 'var(--text-head)' }}>Your Name</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <SelectTrigger className="w-full border-[#e2e5ea] focus:ring-[rgba(29,78,216,.1)] focus:border-[#1d4ed8]" style={{ height: '44px' }}>
                            <SelectValue placeholder="Select your name" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[240px] overflow-y-auto">
                            {predefinedUsers.map((userName) => (
                              <SelectItem key={userName} value={userName} className="py-2">
                                {userName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-semibold"
                  style={{ height: '44px' }}
                  disabled={isSelectingUser || loginMutation.isPending}
                >
                  {isSelectingUser || loginMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}