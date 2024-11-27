import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEventSchema, type InsertEvent } from "@db/schema";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { prefectures } from "@/lib/prefectures";
import { useToast } from "@/hooks/use-toast";

interface EventFormProps {
  onSubmit: (data: InsertEvent) => Promise<void>;
  defaultValues?: Partial<InsertEvent>;
}

export function EventForm({ onSubmit, defaultValues }: EventFormProps) {
  const { toast } = useToast();
  const form = useForm<InsertEvent>({
    resolver: zodResolver(insertEventSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      prefecture: defaultValues?.prefecture ?? "",
      date: defaultValues?.date ? new Date(defaultValues.date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      website: defaultValues?.website ?? "",
      description: defaultValues?.description ?? "",
    },
  });

  const handleSubmit = async (data: InsertEvent) => {
    try {
      await onSubmit(data);
      toast({
        title: "イベントを保存しました",
        description: "イベントの登録が完了しました。",
      });
      form.reset();
    } catch (error) {
      toast({
        title: "エラー",
        description: "イベントの保存に失敗しました。",
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>イベント名</FormLabel>
              <FormControl>
                <Input {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="prefecture"
          render={({ field }) => (
            <FormItem>
              <FormLabel>開催都道府県</FormLabel>
              <Select 
                onValueChange={field.onChange}
                value={field.value || ""}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="都道府県を選択" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {prefectures.map((pref) => (
                    <SelectItem key={pref.id} value={pref.name}>
                      {pref.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>開催日</FormLabel>
              <FormControl>
                <Input 
                  type="datetime-local" 
                  {...field}
                  value={typeof field.value === 'string' ? field.value.slice(0, 16) : new Date(field.value).toISOString().slice(0, 16)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="website"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Webサイト URL</FormLabel>
              <FormControl>
                <Input type="url" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>イベント説明</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit">保存</Button>
      </form>
    </Form>
  );
}
