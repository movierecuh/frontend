/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Footer1 from "@/app/components/Footer";
import NavigationBar from "@/app/components/navbar/navBar";
import Image from "next/image";
import api from "@/lib/http"; // Assuming api is set up as a reusable HTTP client
import Link from "next/link";
import { Heart } from "lucide-react";
import { useAuthStore } from "@/app/store";

interface MovieDetail {
  id: number;
  title: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  release_date: string;
  genres: { id: number; name: string }[];
  imdb_id: string;
}

interface SimilarMovie {
  id: number;
  title: string;
  poster_path: string;
}

interface MovieDetailPageProps {
  params: { id: string };
}

const MovieDetailPage = ({ params }: MovieDetailPageProps) => {
  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [similarMovies, setSimilarMovies] = useState<SimilarMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const { name: userId, isAuthenticated } = useAuthStore();
  const [liked, setLiked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        const { data: movieDetails } = await api(`/movies/details?movieID=${params.id}`);
        setMovie(movieDetails);

        if (isAuthenticated) {
          const { data: recommendations } = await api("/movies/recommendations", {
            method: "POST",
            data: JSON.stringify({ title: movieDetails.title }),
          });
          setSimilarMovies(recommendations || []);
        } else {
          setSimilarMovies([]);
        }
      } catch (error) {
        console.error("Error fetching movie details or recommendations:", error);
        setError("Failed to load movie details. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchMovieDetails();

    const fetchUserPreferences = async () => {
      if (!isAuthenticated) {
        return;
      }

      try {
        const userPreferences = await api(`/users/preferences?user_id=${userId}`);
        setLiked(userPreferences.data.preferences.some((pref: MovieDetail) => pref.id === Number(params.id)));
      } catch (error) {
        console.error("Error fetching user preferences:", error);
      }
    }

    fetchUserPreferences();
  }, [params.id, isAuthenticated]);

  const toggleLike = async () => {
    if (!isAuthenticated) {
      setError("You need to be logged in to like a movie.");
      return;
    }

    setLiked((prevLiked) => !prevLiked);
    if (!movie) {
      return;
    }
    const updatedMovie: any = await api(`/movies/details?movieID=${movie.id}`)
    const updatedMovieId = updatedMovie.id;
    const rollbackLikeStatus = () => {
      setLiked((prevLiked) => !prevLiked);
    };

    try {
      // Fetch existing user preferences
      const userResponse = await api(`https://api.findamovie.me/users/preferences?user_id=${userId}`, {
        method: 'GET',
        headers: {},
      });

      const userPreferences = await userResponse.data?.preferences || [];


      let updatedPreferences;

      if (!updatedMovie.isLiked) {
        // Add the movie to preferences if it is liked
        updatedPreferences = [
          ...userPreferences,
          { ...updatedMovie.data, isLiked: true },
        ];
      } else {
        // Remove the movie from preferences if it is unliked
        updatedPreferences = userPreferences.filter(
          (movie: any) => movie.id !== updatedMovieId
        );
      }

      // Update the preferences on the backend
      await api("/users/preferences", {
        method: "POST",
        data: JSON.stringify({
          user_id: userId,
          movies: updatedPreferences,
        }),
      });

    } catch (error: any) {
      if (error.response?.status === 404) {
        // Handle 404 - No preferences found, start with an empty array
        const updatedPreferences = !updatedMovie.isLiked
          ? [{ ...updatedMovie.data, isLiked: true }]
          : [];

        try {
          // Send the updated preferences to the API
          await api("/users/preferences", {
            method: "POST",
            data: JSON.stringify({
              user_id: userId,
              movies: updatedPreferences,
            }),
          });
        } catch (postError) {
          console.error("Error updating preferences on empty data:", postError);
          rollbackLikeStatus();
        }
      } else {
        console.error("Error fetching preferences:", error);
        rollbackLikeStatus();
      }
    }

  };

  if (loading) {
    return <div className="container mx-auto text-center py-10">Loading...</div>;
  }

  if (!movie) {
    return <div className="container mx-auto text-center py-10">Movie not found.</div>;
  }

  return (
    <div className="container mx-auto">
      <NavigationBar />

      {error && (
        <div className="bg-red-100 text-red-800 px-4 py-2 mb-4 rounded">
          {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-8 mb-8">
        <div className="w-full md:w-1/3">
          <Image
            src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
            alt={movie.title}
            width={500}
            height={750}
            className="rounded-lg shadow-lg"
          />
        </div>
        <div className="w-full md:w-2/3">
          <h1 className="text-4xl font-bold mb-4">{movie.title}
            <button
              onClick={toggleLike}
              className="inline-block ml-3 z-10 p-1 rounded-full bg-white bg-opacity-70 hover:bg-opacity-100 transition-colors"
              aria-label={liked ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart
                size={32}
                className={liked ? "text-red-500" : "text-gray-500"} // Red if liked, gray if not
                fill={liked ? "currentColor" : "none"} // Fill with red if liked
              />
            </button>
          </h1>

          <p className="text-gray-600 mb-4">{movie.release_date}</p>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg font-semibold">IMDb Rating:</span>
            <span className="text-yellow-500 font-bold">{movie.vote_average}</span>
          </div>
          <p className="text-gray-800 mb-4">{movie.overview}</p>
          <a
            href={`https://www.imdb.com/title/${movie.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            View on IMDb
          </a>
        </div>
      </div>

      <div>
        <h2 className="text-3xl font-semibold mb-6">Similar Movies</h2>
        {isAuthenticated ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {similarMovies.map((similarMovie) => (
              <Link href={`/movie/${similarMovie.id}`} key={similarMovie.id}>
                <div className="text-center">
                  <Image
                    src={`https://image.tmdb.org/t/p/w300${similarMovie.poster_path}`}
                    alt={similarMovie.title}
                    width={300}
                    height={450}
                    className="rounded-lg shadow-md"
                  />
                  <p className="text-lg mt-2">{similarMovie.title}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-gray-700">
            Please <Link href="/login" className="text-blue-500 hover:underline">login</Link> to see movie recommendations similar to this movie.
          </p>
        )}
      </div>

      <Footer1 />
    </div>
  );
};

export default MovieDetailPage;
