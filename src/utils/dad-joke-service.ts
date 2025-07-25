export class DadJokeService {
  private jokes = [
    "Why don't scientists trust atoms? Because they make up everything!",
    "Why did the scarecrow win an award? Because he was outstanding in his field!",
    "Why don't eggs tell jokes? They'd crack each other up!",
    "Why did the math book look so sad? Because it had too many problems!",
    "What do you call a fake noodle? An impasta!",
    "Why did the cookie go to the doctor? Because it was feeling crumbly!",
    "What do you call a bear with no teeth? A gummy bear!",
    "Why don't skeletons fight each other? They don't have the guts!",
    "What do you call a fish wearing a bowtie? So-fish-ticated!",
    "Why did the golfer bring two pairs of pants? In case he got a hole in one!",
    "What do you call a can opener that doesn't work? A can't opener!",
    "Why did the scarecrow win an award? Because he was outstanding in his field!",
    "What do you call a bear with no teeth? A gummy bear!",
    "Why don't eggs tell jokes? They'd crack each other up!",
    "What do you call a fake noodle? An impasta!",
    "Why did the cookie go to the doctor? Because it was feeling crumbly!",
    "What do you call a fish wearing a bowtie? So-fish-ticated!",
    "Why don't skeletons fight each other? They don't have the guts!",
    "Why did the golfer bring two pairs of pants? In case he got a hole in one!",
    "What do you call a can opener that doesn't work? A can't opener!"
  ];

  async getRandomJoke(): Promise<string> {
    const randomIndex = Math.floor(Math.random() * this.jokes.length);
    const joke = this.jokes[randomIndex];
    if (!joke) {
      return "Why did the programmer quit his job? Because he didn't get arrays!";
    }
    return joke;
  }
} 