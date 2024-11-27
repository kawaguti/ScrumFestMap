import { useState } from "react";
import { useUser } from "@/hooks/use-user";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, type InsertUser } from "@db/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const { login, register } = useUser();
  const { toast } = useToast();

  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      email: "",
    },
  });

  const onSubmit = async (data: InsertUser) => {
    try {
      const result = isLogin
        ? await login(data)
        : await register(data);

      if (!result.ok) {
        toast({
          title: "エラー",
          description: result.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: isLogin ? "ログイン成功" : "登録成功",
        description: isLogin
          ? "ようこそ！"
          : "アカウントが作成されました。",
      });
    } catch (error) {
      toast({
        title: "エラー",
        description: "予期せぬエラーが発生しました。",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto max-w-md min-h-screen flex items-center justify-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{isLogin ? "ログイン" : "新規登録"}</CardTitle>
          <CardDescription>
            {isLogin
              ? "アカウントをお持ちでない場合は新規登録してください。"
              : "すでにアカウントをお持ちの場合はログインしてください。"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ユーザー名</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!isLogin && (
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>メールアドレス</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>パスワード</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Button type="submit" className="w-full">
                  {isLogin ? "ログイン" : "登録"}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="w-full"
                  onClick={() => setIsLogin(!isLogin)}
                >
                  {isLogin
                    ? "新規登録はこちら"
                    : "ログインはこちら"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
