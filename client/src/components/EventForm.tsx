import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEventSchema, type InsertEvent } from "@db/schema";
import { prefectures } from "@/lib/prefectures";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DialogDescription } from "@/components/ui/dialog";

interface EventFormProps {
  onSubmit: (data: InsertEvent) => Promise<void>;
  defaultValues?: InsertEvent;
}

const roundToNearest15Min = (date: Date) => {
  const minutes = date.getMinutes();
  const remainder = minutes % 15;
  const roundedMinutes = remainder < 8 ? minutes - remainder : minutes + (15 - remainder);
  const newDate = new Date(date);
  newDate.setMinutes(roundedMinutes);
  newDate.setSeconds(0);
  newDate.setMilliseconds(0);
  return newDate;
};

export function EventForm({ onSubmit, defaultValues }: EventFormProps) {
  const form = useForm<InsertEvent>({
    resolver: zodResolver(insertEventSchema),
    defaultValues: defaultValues || {
      name: "",
      prefecture: "",
      date: roundToNearest15Min(new Date()),
      website: "",
      description: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="relative space-y-6 p-6 bg-gradient-to-b from-background via-background/95 to-background/90 rounded-lg shadow-lg border border-primary/10">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-lg opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/30 to-background/60 rounded-lg" />
          <div className="relative z-10 space-y-8">
            <DialogDescription className="text-base text-muted-foreground leading-relaxed">
              イベントの詳細情報を入力してください
            </DialogDescription>

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
                <FormItem>
                  <FormLabel>開催都道府県</FormLabel>
                  <FormControl>
                    <Select
                      defaultValue={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="bg-background/50">
                        <SelectValue placeholder="都道府県を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {prefectures.map((pref) => (
                          <SelectItem
                            key={pref.id}
                            value={pref.name}
                          >
                            {pref.name}
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
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>開催日</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value instanceof Date ? field.value.toISOString().slice(0, 10) : ''}
                      onChange={(e) => {
                        const selectedDate = new Date(e.target.value);
                        if (!isNaN(selectedDate.getTime())) {
                          // 時刻を12:00に固定
                          selectedDate.setHours(12, 0, 0, 0);
                          field.onChange(selectedDate);
                        }
                      }}
                      className="bg-background/50 backdrop-blur-sm border-primary/20 shadow-sm transition-all duration-200 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    />
                  </FormControl>
                  <FormMessage />
                  {field.value instanceof Date && field.value < new Date() && (
                    <p className="text-sm text-orange-500 mt-2 pl-2 border-l-2 border-orange-500/50">
                      過去のイベントです
                    </p>
                  )}
                  {field.value instanceof Date && field.value > new Date(new Date().setFullYear(new Date().getFullYear() + 1)) && (
                    <p className="text-sm text-orange-500 mt-2 pl-2 border-l-2 border-orange-500/50">
                      一年以上先のイベントです
                    </p>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem className="group transition-all duration-200 hover:scale-[1.01]">
                  <FormLabel className="text-base font-semibold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">Webサイト URL</FormLabel>
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
              name="description"
              render={({ field }) => (
                <FormItem className="group transition-all duration-200 hover:scale-[1.01]">
                  <FormLabel className="text-base font-semibold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">イベント説明</FormLabel>
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
