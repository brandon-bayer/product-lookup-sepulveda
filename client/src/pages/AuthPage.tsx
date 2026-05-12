import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { z } from "zod";

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
  "Matthew Greene",
  "Matt Mark",
  "Richard Garcia",
  "Ruben Rodriguez",
  "Shaneen Gottula"
].sort();

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
  "Matthew Greene": "matthewgreen",
  "Matt Mark": "mattmark",
  "Richard Garcia": "richardgarcia",
  "Ruben Rodriguez": "rubenrodriguez",
  "Shaneen Gottula": "shaneengottula"
};

const loginSchema = z.object({
  displayName: z.string().min(1, "Please select your name"),
  password: z.string().min(1, "Password is required"),
});

export default function AuthPage() {
  const { user, loginMutation, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { displayName: "", password: "" },
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    const username = usernameMappings[values.displayName];
    if (!username) return;
    loginMutation.mutate({ username, password: values.password });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--app-bg)' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--fe-accent)' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: 'var(--app-bg)' }}>
      <div className="w-full max-w-sm">
      <h1 className="text-3xl font-bold mb-8 tracking-tight text-center" style={{ color: '#0f172a' }}>
        Product Catalog
      </h1>

      <div className="w-full max-w-sm bg-white rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
          <h2 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Sign In</h2>
        </div>
        <div className="p-5">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium" style={{ color: 'var(--text-head)' }}>Your Name</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger className="w-full border-[#e2e5ea]" style={{ height: '44px' }}>
                          <SelectValue placeholder="Select your name" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[240px] overflow-y-auto">
                          {predefinedUsers.map((name) => (
                            <SelectItem key={name} value={name} className="py-2">
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium" style={{ color: 'var(--text-head)' }}>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter password"
                        className="border-[#e2e5ea]"
                        style={{ height: '44px' }}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full bg-[#988B73] hover:bg-[#887D67] text-white font-semibold"
                style={{ height: '44px' }}
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
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
