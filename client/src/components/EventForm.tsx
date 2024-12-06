import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEventSchema } from "@db/schema";
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
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { prefectures } from "@/lib/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface EventFormProps {
  defaultValues?: {
    name: string;
    prefecture: string;
    date: Date;
    website?: string;
    description?: string;
    youtubePlaylist?: string;
  };
  onSubmit: (data: any) => Promise<void>;
}

function roundToNearest15Min(date: Date) {
  const minutes = date.getMinutes();
  const roundedMinutes = Math.round(minutes / 15) * 15;
  const newDate = new Date(date);
  newDate.setMinutes(roundedMinutes);
  newDate.setSeconds(0);
  newDate.setMilliseconds(0);
  return newDate;
}

export function EventForm({ defaultValues, onSubmit }: EventFormProps) {
  const form = useForm({
    resolver: zodResolver(insertEventSchema),
    defaultValues: defaultValues || {
      name: "",
      prefecture: "",
      date: roundToNearest15Min(new Date()),
      website: "",
      description: "",
      youtubePlaylist: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="space-y-2">
          <div className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="group transition-all duration-200 hover:scale-[1.01]">
                  <FormLabel className="text-base font-semibold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">イベント名</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="bg-background/50 backdrop-blur-sm border-primary/20 shadow-sm transition-all duration-200 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="prefecture"
              render={({ field }) => (
                <FormItem className="group transition-all duration-200 hover:scale-[1.01]">
                  <FormLabel className="text-base font-semibold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">開催都道府県</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background/50 backdrop-blur-sm border-primary/20 shadow-sm transition-all duration-200 focus:border-primary/50 focus:ring-2 focus:ring-primary/20">
                        <SelectValue placeholder="都道府県を選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {prefectures.map((prefecture) => (
                        <SelectItem key={prefecture} value={prefecture}>
                          {prefecture}
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
                <FormItem className="group transition-all duration-200 hover:scale-[1.01]">
                  <FormLabel className="text-base font-semibold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">開催日</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal bg-background/50 backdrop-blur-sm border-primary/20 shadow-sm transition-all duration-200 focus:border-primary/50 focus:ring-2 focus:ring-primary/20",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: ja })
                          ) : (
                            <span>日付を選択</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        locale={ja}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem className="group transition-all duration-200 hover:scale-[1.01]">
                  <FormLabel className="text-base font-semibold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">WebサイトURL（任意）</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      {...field}
                      className="bg-background/50 backdrop-blur-sm border-primary/20 shadow-sm transition-all duration-200 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="youtubePlaylist"
              render={({ field }) => (
                <FormItem className="group transition-all duration-200 hover:scale-[1.01]">
                  <FormLabel className="text-base font-semibold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">YouTubeプレイリストURL（任意）</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      {...field}
                      className="bg-background/50 backdrop-blur-sm border-primary/20 shadow-sm transition-all duration-200 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                      value={field.value || ""}
                      placeholder="https://www.youtube.com/playlist?list=..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="group transition-all duration-200 hover:scale-[1.01]">
                  <FormLabel className="text-base font-semibold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">イベント説明（任意）</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      className="bg-background/50 backdrop-blur-sm border-primary/20 shadow-sm transition-all duration-200 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 min-h-[100px] resize-y"
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-6">
              <Button
                type="submit"
                className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] text-primary-foreground font-semibold"
              >
                保存する
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
