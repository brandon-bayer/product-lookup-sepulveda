import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserCircle } from "lucide-react";
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
  "Leticia Piña",
  "Luis Piña",
  "Lulu Arnold",
  "Marco Bisnar",
  "Marilyn Nelson",
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
  "Leticia Piña": "leticiapina",
  "Luis Piña": "luispina",
  "Lulu Arnold": "luluarnold",
  "Marco Bisnar": "marcobisnar",
  "Marilyn Nelson": "marilynnelson",
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Form column */}
      <div className="w-full md:w-1/2 p-8 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              Contempo Product Search
            </CardTitle>
            <CardDescription className="text-center">
              Sepulveda Location<br />
              Select your name to access the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...userForm}>
              <form onSubmit={userForm.handleSubmit(onUserSelect)} className="space-y-6">
                <FormField
                  control={userForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Your Name</FormLabel>
                      <FormControl>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <SelectTrigger className="w-full h-12">
                            <SelectValue placeholder="Select your name from the list" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px] overflow-y-auto">
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
                  className="w-full h-12 text-base"
                  disabled={isSelectingUser || loginMutation.isPending}
                >
                  {isSelectingUser || loginMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    <>
                      <UserCircle className="mr-2 h-5 w-5" />
                      Continue
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Hero section column */}
      <div className="hidden md:flex md:w-1/2 bg-[#464538] items-center justify-center">
        <div className="p-8 flex items-center justify-center">
          <img 
            src={contempoLogo} 
            alt="Contempo Logo" 
            className="max-w-full h-auto"
            style={{ maxWidth: "80%" }}
          />
        </div>
      </div>
    </div>
  );
}