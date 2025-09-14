import { useState } from "react";
import Calendar from "react-calendar";
import Card from "components/card";
import "react-calendar/dist/Calendar.css";
import { MdChevronLeft, MdChevronRight } from "react-icons/md";
import "assets/css/MiniCalendar.css";

// Define the type for the calendar's value for better type safety
type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

const MiniCalendar = () => {
  // 1. Rename the state setter to `setValue` for clarity.
  const [value, setValue] = useState<Date>(new Date());

  // 2. Create a handler function to bridge the calendar's output and your state.
  const handleDateChange = (newValue: Value) => {
    // The calendar can return a single date, a range, or null.
    // This logic ensures we always set a valid single Date object in our state.
    if (newValue instanceof Date) {
      setValue(newValue);
    }
  };

  return (
    <div>
      <Card extra="flex w-full h-full flex-col px-3 py-3">
        <Calendar
          // 3. Pass the new handler function to the onChange prop.
          onChange={handleDateChange}
          value={value}
          prevLabel={<MdChevronLeft className="ml-1 h-6 w-6 " />}
          nextLabel={<MdChevronRight className="ml-1 h-6 w-6 " />}
          view={"month"}
        />
      </Card>
    </div>
  );
};

export default MiniCalendar;